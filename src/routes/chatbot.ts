import { Router } from 'express';
import { ChatbotService } from '../service/chatbot';
import { ChatbotSettingService } from '../service/chatbotSetting';
import { AvailableModelTypes } from '../common_types/types';

export default function (chatbotService: ChatbotService, chatbotSettingService: ChatbotSettingService) {
  const router = Router();

  router.get("/hello", async (req, res) => {
    res.json({ message: "Hello World!" });
  });

  router.get("/allChatbotSetting", async (req, res) => {
    const chatbotSettings = await chatbotSettingService.getAllChatbotSettings();
    res.json(chatbotSettings);
  });

  router.get("/oneChatbotSetting", async (req, res) => {
    const chatbotSetting = await chatbotSettingService.getChatbotSetting();
    if (!chatbotSetting) {
      return res.status(404).json({ error: "Chatbot setting not found" });
    }
    chatbotSetting.AvailableModelTypes = AvailableModelTypes;
    res.json(chatbotSetting);
  });

  router.patch("/updateChatbotSetting", async (req, res) => {
    await chatbotSettingService.updateChatbotSetting(req.body);
    chatbotService.updateChatbotSetting();
    res.json({ status: "success" });
  });

  router.patch("/resetChatbotSetting", async (req, res) => {
    await chatbotSettingService.resetToDefault();
    chatbotService.updateChatbotSetting();
    res.json({ status: "success" });
  });
  return router;
}
