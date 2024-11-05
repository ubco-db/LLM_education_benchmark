
import { getFileTypeAndName } from '../../../util/utils';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PPTXLoader } from "langchain/document_loaders/fs/pptx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { Document } from "@langchain/core/documents";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";

// store
export const addDocumentsFromPath = async (file: string, path: string, metaData: any = {}) => {
  const { type, name } = getFileTypeAndName(file);

  const directoryLoader = await getDirectoryLoader(path);
  const rawDocuments = await loadDocuments(directoryLoader);
  const documentChunks = await splitDocuments(rawDocuments);

  if (documentChunks.length === 0) {
    throw new Error("No documents found");
  }
  
  const courseId = 1;
  const formattedDocumentChunks = documentChunks.map((document) => {
    return new Document({
      pageContent: document.pageContent,
      metadata: {
        ...metaData,
        loc: document.metadata.loc,
        courseId: courseId,
        type,
        name,
      },
    });
  });

  console.log('Length of formattedDocumentChunks:', formattedDocumentChunks.length);
  // const ids = await addDocuments(formattedDocumentChunks);
};

const getDirectoryLoader = async (filePath: string) => {
  const directoryLoader = new DirectoryLoader(filePath, {
    ".pdf": (path) => new PDFLoader(path, { splitPages: true }),
    '.docx': (path) => new DocxLoader(path),
    ".txt": (path) => new TextLoader(path),
    '.csv': (path) => new CSVLoader(path, 'text'),
    '.pptx': (path) => new PPTXLoader(path),
  });

  return directoryLoader;
};

const loadDocuments = async (directoryLoader: DirectoryLoader) => {
  const documents = await directoryLoader.load();
  return documents;
};

const splitDocuments = async (documents: Document[]) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 600,
    chunkOverlap: 50,
  });

  const documentChunks = await splitter.splitDocuments(documents);
  return documentChunks;
};