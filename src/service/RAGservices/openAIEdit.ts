import OpenAI from "openai";

const openai = new OpenAI();
interface MessageContent {
  text: { value: string };
}
export async function AIeditChunk(chunk: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 3;
  const retryDelay = 10000; // 10 seconds

  while (attempts < maxAttempts) {
    try {
      console.log(`Attempting AI edit for chunk: ${chunk}`);

      const run = await openai.beta.threads.createAndRunPoll({
        assistant_id: "asst_WSIoTAe53qE9n4Mlkz2FjTK4",
        thread: {
          messages: [{ role: "user", content: chunk }],
        },
      });

      if (run.status === "completed") {
        const messages = await openai.beta.threads.messages.list(run.thread_id);
        const content = messages.data[0].content[0] as MessageContent;
        await openai.beta.threads.del(run.thread_id);
        return content.text.value;
      }
    } catch (error: any) {
      if (error.response && error.response.status === 429) {
        console.warn("Rate limit exceeded, retrying in 10 seconds...");
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        attempts++;
      } else {
        console.error("Error during AI edit:", error);
        return "unsuccessful";
      }
    }
  }
  return "unsuccessful";
}
