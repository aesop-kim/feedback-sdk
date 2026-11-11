// radiogroup 키보드 규칙: ↑←는 이전, ↓→는 다음(끝에서 처음으로 돈다), Home/End는 처음/끝. 그 밖의 키는 null.
export function findNextRadioIndex(key: string, currentIndex: number, count: number): number | null {
  if (count <= 0) {
    return null;
  }
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return (currentIndex + 1) % count;
    case "ArrowUp":
    case "ArrowLeft":
      return (currentIndex - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
