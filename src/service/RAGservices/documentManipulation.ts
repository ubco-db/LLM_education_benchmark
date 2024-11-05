import { Ollama } from "@langchain/community/llms/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StructuredOutputParser } from "langchain/output_parsers";
import { parse } from "path";

export const AIeditDocumentChunk = async (documentChunk:any) => {
  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    "Overview": "Editted chunk",
  });

  const prompt = PromptTemplate.fromTemplate(`
    Given this document chunk: {chunk}. The document chunk is from slides, course materials, and so on. Your tasks are to:

    1. Remove unnecessary and unrelated information.
    2. Expand on topics missing details.
    3. Move existing identifying information into the title.
    4. Format the document chunks appropriately.

    Example original document chunk:
      COSC 121. Page 5
      DataInputStream
      Wraps around FileInputStream
      ▪ It reads bytes from the input stream → interprets binary data 
        as primitive types or strings.
      DataInputStream in =
      new DataInputStream(new FileInputStream(“file.dat”));
      Stream chaining is a way of connecting several stream classes 
      together to get the data in the form required
      FileInputStream DataInputStream
      01001101...
      int, double, String, ...
      DataInputStream
      readInt() – int(4 bytes)
      ...other methods
      FileInputStream
      read() - one byte
      
      Formatted output:
        {{ "DataInputStream Overview": "DataInputStream wraps around FileInputStream. It reads bytes from the input stream and interprets binary data as primitive types or strings.Example: DataInputStream in = new DataInputStream(new FileInputStream('file.dat'));" }},
        {{ "Stream Chaining": "Stream chaining is a way of connecting several stream classes together to get the data in the form required.Components:- FileInputStream - DataInputStream ,Example: FileInputStream DataInputStream ,Binary Data: 01001101... ,Data Types: int, double, String, etc." }}
    {format_instructions}
  `);

  const llm = new Ollama({
    model: "llama3",
    baseUrl: "http://localhost:11434"
  });
  console.log(parser.getFormatInstructions());
  const combinedChain = prompt.pipe(llm).pipe(parser);

  const result = await combinedChain.invoke({ 
    chunk: documentChunk,
  format_instructions: parser.getFormatInstructions() });
  // console.log('Result:', result);
  return result;
};

// Example usage
(async () => {
  const documentChunk = `
  Page 8
Practice

Circle 
 - radius: double 
 - numberOfObjects: int 

 + Circle2() 
 + Circle2(radius: double) 

+ getRadius(): double 
 + setRadius(radius: double): void 
 + getNumberOfObjects(): int 
 + getArea(): double

The radius of this circle (default: 1.0). 
The number of circle objects created. 

Constructs a default circle object. 
Constructs a circle object with the specified 
radius. 
Returns the radius of this circle. 
Sets a new radius for this circle. 
Returns the number of circle objects created. 
Returns the area of this circle. 

The + sign indicates public modifier  
The - sign indicates private modifier  
Underlined text is static
  `;

  const editedChunk = await AIeditDocumentChunk(documentChunk);
})();
