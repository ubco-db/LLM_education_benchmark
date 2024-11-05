import { Router, Request, Response } from "express";
import { DocumentService } from "../service/document";
import { ChatbotService } from "../service/chatbot";
const util = require("util");
const fse = require("fs-extra");
import { replaceBlobWithRaw } from "../../util/utils";
import { createUploadDirectory, deleteDirectory, uploadDocuments } from "../../util/upload";

export default function (documentService: DocumentService, chatbotService: ChatbotService) {
  const router = Router();

  // Define routes for document management
  router.post("/document", async (req: Request, res: Response) => {
    const destination = `./public/uploads/${Math.random().toString(16).slice(2)}`;

    try {
      const upload = uploadDocuments(destination);
      upload.single("file");

      const uploadObj = util.promisify(upload.any());
      await uploadObj(req, res);

      const temp: any = req; // An array of uploaded files
      const file = temp.files.find((file: any) => file.fieldname === "file");

      if (!file || temp.files.length != 2) {
        return res.status(400).json({ error: "Invalid request data" });
      }

      const sourceData = await fse.readFile(`${destination}/blob`, "utf-8");
      const json = JSON.parse(sourceData);
      const source = json.source;

      await new Promise((resolve) => setTimeout(resolve, 20000));

      const savedDocuments = await chatbotService.addDocumentsFromPath(file.filename, destination, {
        source,
      });
      res.json(savedDocuments);
    } catch (e) {
      res.status(500).json({ error: e });
      console.error(e);
    } finally {
      await deleteDirectory(destination);
    }
  });

  router.delete("/:docId/document", async (req: Request, res: Response) => {
    const docId = req.params.docId;
    if (!docId) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    const response = await chatbotService.deleteDocuments(docId);
    res.json(response);
  });

  router.post("/document/url/github", async (req: Request, res: Response) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Invalid request data" });
    }
    const formattedUrl = replaceBlobWithRaw(url);
    if (!formattedUrl) {
      return res.status(400).json({ error: "Invalid url format" });
    }

    try {
      const response = await chatbotService.addDocumentsFromURL(formattedUrl);
      res.json(response);
    } catch (e) {
      res.status(500).json({ error: e });
    }
  });

  router.get("/document/AIedit", async (req: Request, res: Response) => {
    // receives a document chunk and trims it to get rid of unnecessary information, add necessary depth to the text
    // and returns the edited document chunk
    try {
      const response = await documentService.AIedit();
      res.json(response);
    } catch (e) {
      res.status(500).json({ error: e });
    }
  });
  router.get("/aggregateDocuments", async (req: Request, res: Response) => {
    try {
      const result = await documentService.getAllAggregateDocuments();
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e });
    }
  });

  router.get("/allDocumentChunks", async (req: Request, res: Response) => {
    try {
      const result = await documentService.getAllDocumentChunks();
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e });
    }
  });

  router.delete("/documentChunk/:docId", async (req: Request, res: Response) => {
    const docId = req.params.docId;
    if (!docId) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    try {
      const result = await documentService.deleteDocumentChunk(docId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e });
    }
  });

  router.patch("/:docId/documentChunk", async (req: Request, res: Response) => {
    const docId = req.params.docId;
    const { documentText, metadata } = req.body;

    if (!docId || !documentText) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    try {
      const result = await documentService.updateDocumentChunk(docId, documentText, metadata);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e });
    }
  });

  router.post("/documentChunk", async (req: Request, res: Response) => {
    const { documentText, metadata } = req.body;

    if (!documentText) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    try {
      const result = await documentService.addDocumentChunk(documentText, metadata);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e });
    }
  });
  return router;
}
