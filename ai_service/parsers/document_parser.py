import os
import logging
from langchain_community.document_loaders import PyMuPDFLoader, Docx2txtLoader, TextLoader, CSVLoader
import pytesseract
from pdf2image import convert_from_path

logger = logging.getLogger(__name__)

class DocumentParser:
    def __init__(self):
        pass

    def parse_document(self, file_path: str):
        """
        Parses a document (PDF, Word, TXT, CSV, etc.) using LangChain Loaders
        Extracts text, tables, and metadata.
        """
        try:
            logger.info(f"Parsing document: {file_path}")
            
            ext = os.path.splitext(file_path)[1].lower()
            
            if ext == '.pdf':
                loader = PyMuPDFLoader(file_path)
                docs = loader.load()
                
                # Check if text is extremely sparse (likely a scanned PDF)
                total_text_len = sum(len(doc.page_content.strip()) for doc in docs)
                if total_text_len < 50:
                    logger.info(f"Minimal text found in PDF ({total_text_len} chars). Triggering OCR fallback for {file_path}")
                    images = convert_from_path(file_path)
                    docs = []
                    for i, img in enumerate(images):
                        text = pytesseract.image_to_string(img)
                        docs.append({
                            "text": text,
                            "type": "text",
                            "metadata": {"source": file_path, "page": i + 1, "ocr": True}
                        })
                    return docs
            elif ext in ['.docx', '.doc']:
                loader = Docx2txtLoader(file_path)
                docs = loader.load()
            elif ext == '.csv':
                loader = CSVLoader(file_path)
                docs = loader.load()
            else:
                loader = TextLoader(file_path)
                docs = loader.load()
                
            parsed_data = []
            for doc in docs:
                parsed_data.append({
                    "text": doc.page_content,
                    "type": "text",
                    "metadata": doc.metadata
                })
                
            return parsed_data
        except Exception as e:
            logger.error(f"Error parsing document {file_path}: {e}")
            raise e
