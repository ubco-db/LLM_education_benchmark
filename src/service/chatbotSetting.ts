import { TypeORMVectorStore } from '@langchain/community/vectorstores/typeorm';
import { AvailableModelTypes, UpdateChatbotSettingParams, defaultChatbotSetting } from '../common_types/types';
import { Repository } from 'typeorm';
export class ChatbotSettingService {
  private courseSettingRepository: Repository<any>;

  constructor(private chatbotSettingStore: TypeORMVectorStore, private courseId: string) {
    this.courseSettingRepository = chatbotSettingStore.appDataSource.getRepository(chatbotSettingStore.documentEntity);
  }



  getChatbotSetting = async () => {

    const chatbotSetting = await this.courseSettingRepository.createQueryBuilder("course_setting")
      .select(["course_setting.id", "course_setting.pageContent", "course_setting.metadata"])
      .where("\"course_setting\".\"pageContent\" = :id", { id: this.courseId })
      .getOne();

    return chatbotSetting;
  }

  getAllChatbotSettings = async () => {

    const chatbotSettings = await this.courseSettingRepository.createQueryBuilder("course_setting")
      .select(["course_setting.id", "course_setting.pageContent", "course_setting.metadata"])
      .getMany();

    return chatbotSettings;
  };

  resetToDefault = async () => {
    const chatbotSettings = await this.courseSettingRepository.createQueryBuilder("course_setting")
      .update()
      .set({ metadata: defaultChatbotSetting })
      .where("\"course_setting\".\"pageContent\" = :id", { id: this.courseId })
      .execute();
    return chatbotSettings;
  }

  updateChatbotSetting = async (
    params: UpdateChatbotSettingParams
  ) => {

    const entry = await this.courseSettingRepository
      .createQueryBuilder("course_setting")
      .where("course_setting.pageContent = :id", { id: this.courseId })
      .getOne();

    if (!entry) {
      throw new Error('CourseSetting not found');
    }

    // Update the metadata with new values only if they are provided
    entry.metadata = {
      ...entry.metadata,
      ...(params.prompt !== undefined && { prompt: params.prompt }),
      ...(params.modelName !== undefined && { modelName: params.modelName }),
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.topK !== undefined && { topK: params.topK }),
      ...(params.similarityThresholdDocuments !== undefined && { similarityThresholdDocuments: params.similarityThresholdDocuments }),
      ...(params.similarityThresholdQuestions !== undefined && { similarityThresholdQuestions: params.similarityThresholdQuestions }),
    };

    // Save the updated entry
    return await this.courseSettingRepository.save(entry);
  };
}