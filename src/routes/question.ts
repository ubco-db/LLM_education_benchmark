import { Router } from 'express';
import { ChatbotService } from '../service/chatbot';
import { QuestionService } from '../service/question';

export default function (chatbotService: ChatbotService, questionService: QuestionService) {
  const router = Router();

  router.post("/ask", async (req, res) => {
    const { question, history } = req.body;

    if (!question || !history) {
      return res.status(400).json({ error: "Invalid request data" });
    }
    // find the service corresponding to the courseId, wrapper returns the right service
    const result = await chatbotService.ask(question, history);
    res.json(result);
  });

  router.patch("/question", async (req, res) => {
    const { id, question, answer, verified, sourceDocuments } = req.body;

    if (!id || !answer) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    try {
      const result = await questionService.updateQuestion(id, question, answer, verified, sourceDocuments);
      if (result.error) {
        return res.status(result.statusCode).json({ error: result.error });
      }
      res.json({ result });
    } catch (error) {
      return res.status(500).json({ error: "Error updating question: " + error });
    }
  });
  // Route to reset chatbot data
  router.get("/resetCourse", async (req, res) => {
    await chatbotService.resetCourse();
    console.log("Resetting All Chatbot Data...");
    res.json({ status: "success" });
  });

  // Route to get all questions for a course
  router.get("/allQuestions", async (req, res) => {
    const result = await questionService.getAllQuestions();
    res.json(result);
  });

  router.delete("/deleteAllQuestions", async (req, res) => {
    const result = await questionService.deleteAllQuestions();
    res.json(result);
  });


  return router;
}
