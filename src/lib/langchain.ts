export function buildRagChain() {
  return {
    stream: async function* (input: any) {
      yield { text: "Mocked response" };
    }
  };
}
