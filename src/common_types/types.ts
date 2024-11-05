export enum AvailableModelTypes {
  GPT3 = "gpt-3.5-turbo-0125",
  GPT4 = "gpt-4-turbo-0125",
  LLAMA = "llama3",
}

export type UpdateChatbotSettingParams = {
  prompt?: string;
  modelName?: AvailableModelTypes;
  temperature?: number;
  topK?: number;
  similarityThresholdDocuments?: number;
  similarityThresholdQuestions?: number;
};

export const defaultChatbotSetting = {
  prompt: `RULES: 
  1) If you don't know the answer just say that you "I don't know", do not try to make up an answer.
  2) If you unsure of the answer, you shall PREFACE your answer with "I'm not sure, but this is what I think."
  3) Provide an answer in ONLY 5 sentences or less. Try to be as concise as possible.
  4) Do not use any other resources apart from the context provided to you.`,
  modelName: AvailableModelTypes.GPT3,
  temperature: 0.7,
  topK: 5,
  similarityThresholdDocuments: 0.6,
  similarityThresholdQuestions: 0.9,
};

export const assistant_mapping_id: { [key: string]: string } = {
  COSC304: "asst_6afLJ8cgb0gVNpBbuVcwPfXe",
  COSC404: "asst_PVOIAE9k2ryjGIRsjqDd9EOZ",
  COSC111: "asst_aeOhU29gUq2a3QkvFbAYXS9m",
  COSC121: "asst_rppQJGfIHrGR3e7wktDlWmx2",
};
