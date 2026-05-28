export const runtimeInput = {
  movement: { x: 0, y: 0 },
  jump: false,
  action1: false,
  action2: false,
};

export const consumeJump = () => {
  const wasJump = runtimeInput.jump;
  runtimeInput.jump = false;
  return wasJump;
};
