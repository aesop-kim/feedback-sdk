// 녹화 원본(demo/raw)과 카드(demo/cards)를 demo/timeline.json 순서대로 이어 데모 영상을 만든다.
// 장면마다 따로 렌더링(자르기 → 줌 → 배경 프레임 → 캡션)한 뒤, 크로스페이드로 잇고 고객 내레이션을 깐다.
//
// 실행: node demo/scripts/assemble.mjs [옵션]
//   --raw <폴더>            녹화 원본 폴더 (기본 demo/raw: customer.webm, admin.webm, cues.json)
//   --output <파일>         결과 mp4 (기본 demo/build/lattice-voice-qa-demo.mp4)
//   --draft                 4K 업스케일 없이 빠르게(확인용)
//   --pad                   아주 옅은 생성 패드 소리를 깐다(기본: 없음)
//   --narration-shift <초>  내레이션을 화면보다 늦게(+)/빠르게(-) 민다
//   --shift-customer <초>, --shift-admin <초>  컷 위치를 영상 기준으로 민다(원본 시각 보정)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  CAPTION_CENTER_Y,
  CARDS_DIRECTORY,
  DEMO_DIRECTORY,
  FRAMES_PER_SECOND,
  OUTPUT_HEIGHT,
  OUTPUT_WIDTH,
  PROJECT_DIRECTORY,
  SCREEN,
} from "./frame-layout.mjs";

const NARRATION_PATH = path.join(PROJECT_DIRECTORY, "fixtures/demo-recording/narration.wav");
const UPSCALE_WIDTH = 3840;
const UPSCALE_HEIGHT = 2160;
const CAPTION_FADE_SECONDS = 0.22;
const CAPTION_RISE_PIXELS = 8;
const SPEECH_TAIL_SECONDS = 0.3;
const AUDIO_EDGE_FADE_SECONDS = 0.08;

function parseArguments(argumentList) {
  const options = {
    raw: path.join(DEMO_DIRECTORY, "raw"),
    output: path.join(DEMO_DIRECTORY, "build/lattice-voice-qa-demo.mp4"),
    draft: false,
    pad: false,
    narrationShift: 0,
    shift: { customer: 0, admin: 0 },
  };
  for (let index = 0; index < argumentList.length; index += 1) {
    const name = argumentList[index];
    const value = argumentList[index + 1];
    switch (name) {
      case "--raw":
        options.raw = path.resolve(value);
        index += 1;
        break;
      case "--output":
        options.output = path.resolve(value);
        index += 1;
        break;
      case "--draft":
        options.draft = true;
        break;
      case "--pad":
        options.pad = true;
        break;
      case "--narration-shift":
        options.narrationShift = Number(value);
        index += 1;
        break;
      case "--shift-customer":
        options.shift.customer = Number(value);
        index += 1;
        break;
      case "--shift-admin":
        options.shift.admin = Number(value);
        index += 1;
        break;
      default:
        throw new Error(`모르는 옵션이에요: ${name}`);
    }
  }
  return options;
}

function runCommand(command, argumentList) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentList, { stdio: ["ignore", "pipe", "pipe"] });
    let standardOutput = "";
    let standardError = "";
    child.stdout.on("data", (chunk) => {
      standardOutput += chunk;
    });
    child.stderr.on("data", (chunk) => {
      standardError += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(standardOutput);
        return;
      }
      reject(new Error(`${command} 실패(${code})\n${standardError.slice(-4000)}`));
    });
  });
}

function runFfmpeg(argumentList) {
  return runCommand("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argumentList]);
}

async function probeFormat(filePath) {
  const output = await runCommand("ffprobe", ["-v", "error", "-show_entries", "format=duration:format_tags=creation_time", "-of", "json", filePath]);
  const { format } = JSON.parse(output);
  return { duration: Number(format.duration), creationTime: format.tags?.creation_time ?? null };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function roundSeconds(value) {
  return Math.round(value * 1000) / 1000;
}

function smoothstepExpression(progressExpression) {
  return `(3*pow(${progressExpression},2)-2*pow(${progressExpression},3))`;
}

// ---------- 원본 시각 계산 ----------

// 녹화 파일의 creation_time(영상 첫 프레임)과 컨텍스트를 만든 시각의 차이만큼 cue 시각을 영상 시각으로 옮긴다.
async function loadSources(options) {
  const cueFile = await readJson(path.join(options.raw, "cues.json"));
  const sources = {};
  for (const [name, context] of Object.entries(cueFile.contexts)) {
    const videoPath = path.join(options.raw, context.video);
    const { duration, creationTime } = await probeFormat(videoPath);
    const creationMs = creationTime ? Date.parse(creationTime) : Number.NaN;
    const recorderDelay = Number.isFinite(creationMs) && context.createdAtMs ? (creationMs - context.createdAtMs) / 1000 : 0;
    const usableDelay = recorderDelay > 0 && recorderDelay < 5 ? recorderDelay : 0;
    sources[name] = {
      videoPath,
      duration,
      offset: usableDelay - (options.shift[name] ?? 0),
      cues: cueFile.cues.filter((cue) => cue.context === name),
    };
    console.log(`원본  ${name}: ${duration.toFixed(1)}초, 시작 보정 ${usableDelay.toFixed(3)}초`);
  }
  return sources;
}

function findCue(source, cueReference) {
  const names = Array.isArray(cueReference) ? cueReference : [cueReference];
  for (const name of names) {
    const cue = source.cues.find((candidate) => candidate.name === name);
    if (cue) {
      return cue;
    }
  }
  throw new Error(`cues.json에 없는 cue예요: ${names.join(" / ")}`);
}

function getVideoTime(source, reference) {
  return findCue(source, reference.cue).t + (reference.offset ?? 0) - source.offset;
}

// ---------- 줌 ----------

function getFocusPoint(source, focus) {
  if (typeof focus.x === "number" && typeof focus.y === "number") {
    return { x: focus.x, y: focus.y };
  }
  const cue = findCue(source, focus.cue);
  if (typeof cue.x !== "number" || typeof cue.y !== "number") {
    throw new Error(`cue '${cue.name}'에는 가리킨 지점이 없어요`);
  }
  return { x: cue.x + (focus.dx ?? 0), y: cue.y + (focus.dy ?? 0) };
}

// 키프레임을 장면 안 시각으로 바꾼다. 시작 상태는 1배, 가운데.
function resolveZoomMoves(segment, source, sourceStart, defaults) {
  return (segment.zooms ?? []).map((zoom) => {
    const localStart = typeof zoom.at.local === "number" ? zoom.at.local : (getVideoTime(source, zoom.at) - sourceStart) / segment.speed;
    return {
      start: localStart,
      seconds: zoom.seconds ?? defaults.zoomSeconds,
      zoom: zoom.zoom,
      focus: getFocusPoint(source, zoom.focus),
    };
  });
}

// 구간별 smoothstep 보간 식. 이동 사이에는 앞 값을 유지한다.
function buildKeyframeExpression(moves, initialValue, pickValue, timeExpression) {
  let expression = `${pickValue(moves.at(-1))}`;
  for (let index = moves.length - 1; index >= 0; index -= 1) {
    const move = moves[index];
    const previousValue = index === 0 ? initialValue : pickValue(moves[index - 1]);
    const progress = `clip((${timeExpression}-${move.start.toFixed(4)})/${move.seconds.toFixed(4)},0,1)`;
    const blended = `(${previousValue}+(${pickValue(move)}-(${previousValue}))*${smoothstepExpression(progress)})`;
    expression = `if(lt(${timeExpression},${(move.start + move.seconds).toFixed(4)}),${blended},${expression})`;
  }
  return expression;
}

function buildZoomFilter(moves, outputSize, isDraft) {
  const time = `(on/${FRAMES_PER_SECOND})`;
  const zoomExpression = buildKeyframeExpression(moves, "1", (move) => move.zoom.toFixed(4), time);
  const centerXExpression = buildKeyframeExpression(moves, "0.5", (move) => move.focus.x.toFixed(4), time);
  const centerYExpression = buildKeyframeExpression(moves, "0.5", (move) => move.focus.y.toFixed(4), time);
  const upscale = isDraft ? "" : `scale=${UPSCALE_WIDTH}:${UPSCALE_HEIGHT}:flags=lanczos,`;
  return (
    `${upscale}zoompan=z='${zoomExpression}'` +
    `:x='clip(${centerXExpression}*iw-iw/zoom/2,0,iw-iw/zoom)'` +
    `:y='clip(${centerYExpression}*ih-ih/zoom/2,0,ih-ih/zoom)'` +
    `:d=1:s=${outputSize.width}x${outputSize.height}:fps=${FRAMES_PER_SECOND}`
  );
}

// ---------- 캡션 ----------

function buildSceneCaption(segment, captionById, seconds) {
  if (!segment.caption) {
    return [];
  }
  if (!captionById.has(segment.caption)) {
    throw new Error(`captions.json에 없는 캡션이에요: ${segment.caption}`);
  }
  const start = segment.type === "card" ? 0.35 : 0.3;
  return [{ id: segment.caption, start, end: Math.max(start + 0.5, seconds - 0.15) }];
}

// 내레이션 구간과 겹치는 대사 자막을 장면 안 시각으로 옮긴다.
function buildSpeechCaptions(captions, narrationStart, seconds, speed) {
  const speechCaptions = captions.filter((caption) => caption.kind === "speech");
  const placed = [];
  speechCaptions.forEach((caption, index) => {
    const nextCaption = speechCaptions[index + 1];
    const tail = nextCaption ? Math.min(SPEECH_TAIL_SECONDS, nextCaption.narrationStart - caption.narrationEnd) : SPEECH_TAIL_SECONDS;
    const start = (caption.narrationStart - narrationStart) / speed;
    const end = (caption.narrationEnd + tail - narrationStart) / speed;
    if (end <= 0.2 || start >= seconds - 0.2) {
      return;
    }
    placed.push({ id: caption.id, start: Math.max(0.05, start), end: Math.min(seconds - 0.05, end) });
  });
  return placed;
}

function appendCaptionOverlays(filters, inputArguments, captionPlacements, startLabel, firstInputIndex) {
  let currentLabel = startLabel;
  captionPlacements.forEach((placement, index) => {
    const inputIndex = firstInputIndex + index;
    const length = placement.end - placement.start;
    inputArguments.push("-loop", "1", "-framerate", String(FRAMES_PER_SECOND), "-t", length.toFixed(3), "-i", path.join(CARDS_DIRECTORY, `caption-${placement.id}.png`));
    const fadeOutStart = Math.max(0, length - CAPTION_FADE_SECONDS).toFixed(3);
    filters.push(
      `[${inputIndex}:v]format=rgba,fade=t=in:st=0:d=${CAPTION_FADE_SECONDS}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${CAPTION_FADE_SECONDS}:alpha=1,` +
        `setpts=PTS-STARTPTS+${placement.start.toFixed(3)}/TB[caption${index}]`,
    );
    const rise = `${CAPTION_RISE_PIXELS}*pow(1-clip((t-${placement.start.toFixed(3)})/0.3,0,1),2)`;
    const nextLabel = `captioned${index}`;
    filters.push(`[${currentLabel}][caption${index}]overlay=x=(W-w)/2:y='${CAPTION_CENTER_Y}-h/2+${rise}':eof_action=pass[${nextLabel}]`);
    currentLabel = nextLabel;
  });
  return currentLabel;
}

// ---------- 장면 렌더링 ----------

function getEncodeArguments(isDraft) {
  if (isDraft) {
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"];
  }
  return ["-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p"];
}

async function renderCardSegment(segment, captionById, outputPath, isDraft) {
  const frameCount = Math.round(segment.seconds * FRAMES_PER_SECOND);
  const inputArguments = ["-loop", "1", "-framerate", String(FRAMES_PER_SECOND), "-t", segment.seconds.toFixed(3), "-i", path.join(CARDS_DIRECTORY, segment.card)];
  const filters = [];
  if (segment.pushIn) {
    // 천천히 밀고 들어가는 정지 화면. 4K로 올려서 줌하면 떨림이 거의 없다.
    const upscale = isDraft ? "" : `scale=${UPSCALE_WIDTH}:${UPSCALE_HEIGHT}:flags=lanczos,`;
    const zoom = `1+${segment.pushIn}*${smoothstepExpression(`(on/${frameCount})`)}`;
    filters.push(
      `[0:v]${upscale}zoompan=z='${zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${FRAMES_PER_SECOND}[base]`,
    );
  } else {
    filters.push(`[0:v]fps=${FRAMES_PER_SECOND},format=rgba[base]`);
  }
  const captionPlacements = buildSceneCaption(segment, captionById, segment.seconds);
  let lastLabel = appendCaptionOverlays(filters, inputArguments, captionPlacements, "base", 1);
  if (segment.fadeOutSeconds) {
    filters.push(`[${lastLabel}]fade=t=out:st=${(segment.seconds - segment.fadeOutSeconds).toFixed(3)}:d=${segment.fadeOutSeconds}:color=0xF2F4F6[faded]`);
    lastLabel = "faded";
  }
  filters.push(`[${lastLabel}]format=yuv420p[out]`);
  await runFfmpeg([
    ...inputArguments,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-frames:v",
    String(frameCount),
    "-r",
    String(FRAMES_PER_SECOND),
    ...getEncodeArguments(isDraft),
    outputPath,
  ]);
  return { seconds: frameCount / FRAMES_PER_SECOND, narration: null };
}

async function renderClipSegment(segment, context, outputPath) {
  const { sources, captions, captionById, defaults, options } = context;
  const source = sources[segment.source];
  if (!source) {
    throw new Error(`원본이 없어요: ${segment.source}`);
  }
  const speed = segment.speed ?? 1;
  const sourceStart = Math.max(0, getVideoTime(source, segment.from));
  const sourceEnd = Math.min(source.duration, getVideoTime(source, segment.to));
  if (sourceEnd - sourceStart < 0.5) {
    throw new Error(`장면 '${segment.id}' 구간이 너무 짧아요 (${sourceStart.toFixed(2)}~${sourceEnd.toFixed(2)})`);
  }
  const frameCount = Math.round(((sourceEnd - sourceStart) / speed) * FRAMES_PER_SECOND);
  const seconds = frameCount / FRAMES_PER_SECOND;
  const moves = resolveZoomMoves({ ...segment, speed }, source, sourceStart, defaults);

  const inputArguments = [
    "-ss", sourceStart.toFixed(3), "-t", (sourceEnd - sourceStart + 0.5).toFixed(3), "-i", source.videoPath,
    "-loop", "1", "-framerate", String(FRAMES_PER_SECOND), "-t", seconds.toFixed(3), "-i", path.join(CARDS_DIRECTORY, "frame-background.png"),
    "-loop", "1", "-framerate", String(FRAMES_PER_SECOND), "-t", seconds.toFixed(3), "-i", path.join(CARDS_DIRECTORY, "screen-mask.png"),
    "-loop", "1", "-framerate", String(FRAMES_PER_SECOND), "-t", seconds.toFixed(3), "-i", path.join(CARDS_DIRECTORY, "frame-border.png"),
  ];
  const screenSize = { width: SCREEN.width, height: SCREEN.height };
  const zoomOrScale = moves.length > 0 ? buildZoomFilter(moves, screenSize, options.draft) : `scale=${SCREEN.width}:${SCREEN.height}:flags=lanczos`;
  const filters = [
    `[0:v]setpts=(PTS-STARTPTS)/${speed},fps=${FRAMES_PER_SECOND},tpad=stop_mode=clone:stop_duration=2,trim=end_frame=${frameCount},${zoomOrScale},format=rgba[screen]`,
    `[2:v]format=gray[mask]`,
    `[screen][mask]alphamerge[rounded]`,
    `[1:v]format=rgba[background]`,
    `[background][rounded]overlay=${SCREEN.x}:${SCREEN.y}[framed]`,
    `[framed][3:v]overlay=${SCREEN.x}:${SCREEN.y}[bordered]`,
  ];

  let narration = null;
  let captionPlacements = buildSceneCaption(segment, captionById, seconds);
  if (segment.narration) {
    const recordingStart = getVideoTime(sources.customer, { cue: "recording-start" }) + options.narrationShift;
    const narrationStart = sourceStart - recordingStart;
    narration = { start: narrationStart, end: narrationStart + (sourceEnd - sourceStart), speed };
    captionPlacements = [...captionPlacements, ...buildSpeechCaptions(captions, narrationStart, seconds, speed)];
  }
  const lastLabel = appendCaptionOverlays(filters, inputArguments, captionPlacements, "bordered", 4);
  filters.push(`[${lastLabel}]format=yuv420p[out]`);

  await runFfmpeg([
    ...inputArguments,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-frames:v",
    String(frameCount),
    "-r",
    String(FRAMES_PER_SECOND),
    ...getEncodeArguments(options.draft),
    outputPath,
  ]);
  return { seconds, narration };
}

// ---------- 잇기 + 소리 ----------

function buildAudioFilters(placedSegments, totalSeconds, narrationInputIndex, padInputIndex) {
  // 무음 바탕을 0초부터 깔아 소리 트랙이 영상과 같은 시각에 시작하게 한다.
  const filters = [`anullsrc=r=48000:cl=stereo,atrim=0:${totalSeconds.toFixed(3)}[silence]`];
  const mixLabels = ["[silence]"];
  placedSegments
    .filter((placed) => placed.narration)
    .forEach((placed, index) => {
      const { start, end, speed } = placed.narration;
      const clippedStart = Math.max(0, start);
      const length = (end - clippedStart) / speed;
      const delayMs = Math.round((placed.globalStart + (clippedStart - start) / speed) * 1000);
      const tempo = speed === 1 ? "" : `,atempo=${speed}`;
      filters.push(
        `[${narrationInputIndex}:a]atrim=start=${clippedStart.toFixed(3)}:end=${end.toFixed(3)},asetpts=PTS-STARTPTS${tempo},` +
          `afade=t=in:d=${AUDIO_EDGE_FADE_SECONDS},afade=t=out:st=${Math.max(0, length - AUDIO_EDGE_FADE_SECONDS).toFixed(3)}:d=${AUDIO_EDGE_FADE_SECONDS},` +
          `aformat=sample_rates=48000:channel_layouts=stereo,adelay=${delayMs}|${delayMs}[voice${index}]`,
      );
      mixLabels.push(`[voice${index}]`);
    });
  if (padInputIndex !== null) {
    filters.push(
      `[${padInputIndex}:a]lowpass=f=900,volume=0.05,afade=t=in:d=2.5,afade=t=out:st=${(totalSeconds - 3).toFixed(3)}:d=3,aformat=sample_rates=48000:channel_layouts=stereo[pad]`,
    );
    mixLabels.push("[pad]");
  }
  filters.push(
    `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:normalize=0:dropout_transition=0,apad,atrim=0:${totalSeconds.toFixed(3)},` +
      `loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[audio]`,
  );
  return filters;
}

async function joinSegments(renderedSegments, options) {
  const inputArguments = [];
  const filters = [];
  renderedSegments.forEach((rendered, index) => {
    inputArguments.push("-i", rendered.path);
    filters.push(`[${index}:v]fps=${FRAMES_PER_SECOND},settb=1/${FRAMES_PER_SECOND},setpts=PTS-STARTPTS[segment${index}]`);
  });

  // 장면을 차례로 붙이며 각 장면이 전체 영상 몇 초에 시작하는지 기록한다(소리 위치에 쓴다).
  let timelineSeconds = 0;
  let currentLabel = "segment0";
  const placedSegments = [{ ...renderedSegments[0], globalStart: 0 }];
  timelineSeconds = renderedSegments[0].seconds;
  for (let index = 1; index < renderedSegments.length; index += 1) {
    const rendered = renderedSegments[index];
    const nextLabel = `joined${index}`;
    if (rendered.transition === "fade") {
      const offset = timelineSeconds - rendered.transitionSeconds;
      filters.push(
        `[${currentLabel}][segment${index}]xfade=transition=fade:duration=${rendered.transitionSeconds}:offset=${offset.toFixed(3)},settb=1/${FRAMES_PER_SECOND}[${nextLabel}]`,
      );
      placedSegments.push({ ...rendered, globalStart: offset });
      timelineSeconds = offset + rendered.seconds;
    } else {
      filters.push(`[${currentLabel}][segment${index}]concat=n=2:v=1:a=0,settb=1/${FRAMES_PER_SECOND}[${nextLabel}]`);
      placedSegments.push({ ...rendered, globalStart: timelineSeconds });
      timelineSeconds += rendered.seconds;
    }
    currentLabel = nextLabel;
  }
  filters.push(`[${currentLabel}]format=yuv420p[video]`);

  const narrationInputIndex = renderedSegments.length;
  inputArguments.push("-i", NARRATION_PATH);
  let padInputIndex = null;
  if (options.pad) {
    padInputIndex = renderedSegments.length + 1;
    // A2·E3·A3·C#4 사인파를 아주 작게 겹친 패드. 외부 음원을 쓰지 않는다.
    inputArguments.push(
      "-f",
      "lavfi",
      "-t",
      timelineSeconds.toFixed(3),
      "-i",
      "aevalsrc='0.25*sin(2*PI*110*t)+0.18*sin(2*PI*164.81*t)+0.14*sin(2*PI*220*t)+0.08*sin(2*PI*277.18*t)':s=48000",
    );
  }
  filters.push(...buildAudioFilters(placedSegments, timelineSeconds, narrationInputIndex, padInputIndex));

  const encodeArguments = options.draft
    ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]
    : ["-c:v", "libx264", "-preset", "slow", "-crf", "16"];
  await mkdir(path.dirname(options.output), { recursive: true });
  await runFfmpeg([
    ...inputArguments,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[video]",
    "-map",
    "[audio]",
    ...encodeArguments,
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(FRAMES_PER_SECOND),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-t",
    timelineSeconds.toFixed(3),
    "-movflags",
    "+faststart",
    options.output,
  ]);
  return { timelineSeconds, placedSegments };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  for (const requiredPath of [path.join(options.raw, "cues.json"), path.join(CARDS_DIRECTORY, "frame-background.png"), NARRATION_PATH]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`필요한 파일이 없어요: ${requiredPath}\n(cards는 npm run demo:cards, 내레이션은 bash scripts/make-narration-audio.sh)`);
    }
  }
  const timeline = await readJson(path.join(DEMO_DIRECTORY, "timeline.json"));
  const { captions } = await readJson(path.join(DEMO_DIRECTORY, "captions.json"));
  const captionById = new Map(captions.map((caption) => [caption.id, caption]));
  const sources = await loadSources(options);
  const defaults = timeline.defaults;
  const context = { sources, captions, captionById, defaults, options };

  const segmentDirectory = path.join(path.dirname(options.output), "segments");
  await rm(segmentDirectory, { recursive: true, force: true });
  await mkdir(segmentDirectory, { recursive: true });

  const renderedSegments = [];
  for (const [index, segment] of timeline.segments.entries()) {
    const outputPath = path.join(segmentDirectory, `${String(index + 1).padStart(2, "0")}-${segment.id}.mp4`);
    const startedAt = Date.now();
    const result =
      segment.type === "card" ? await renderCardSegment(segment, captionById, outputPath, options.draft) : await renderClipSegment(segment, context, outputPath);
    renderedSegments.push({
      id: segment.id,
      path: outputPath,
      seconds: result.seconds,
      narration: result.narration,
      transition: segment.transition ?? defaults.transition,
      transitionSeconds: segment.transitionSeconds ?? defaults.transitionSeconds,
    });
    console.log(`장면  ${String(index + 1).padStart(2, "0")} ${segment.id.padEnd(22)} ${result.seconds.toFixed(2)}초  (${((Date.now() - startedAt) / 1000).toFixed(1)}초 걸림)`);
  }

  const { timelineSeconds, placedSegments } = await joinSegments(renderedSegments, options);
  for (const placed of placedSegments) {
    console.log(`배치  ${roundSeconds(placed.globalStart).toFixed(2).padStart(6)}초  ${placed.id}`);
  }
  console.log(`완성  ${path.relative(PROJECT_DIRECTORY, options.output)} (${timelineSeconds.toFixed(2)}초)`);
}

await main();
