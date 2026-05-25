import os
import logging
from langchain_community.document_loaders import PyMuPDFLoader, Docx2txtLoader, TextLoader, CSVLoader

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
            elif ext in ['.docx', '.doc']:
                loader = Docx2txtLoader(file_path)
            elif ext == '.csv':
                loader = CSVLoader(file_path)
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
