import { Request } from 'express';
import { ChatbotService } from '../service/chatbot';
import { QuestionService } from '../service/question';
import { DocumentService } from '../service/document';
import { ChatbotSettingService } from '../service/chatbotSetting';

export interface Services {
  chatbotService: ChatbotService;
  questionService: QuestionService;
  documentService: DocumentService;
  chatbotSettingService: ChatbotSettingService;
}
export interface CustomRequest extends Request {
  services?: Services;
}
