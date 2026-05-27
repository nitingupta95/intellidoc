from langchain_text_splitters import RecursiveCharacterTextSplitter

class SemanticChunker:
    def __init__(self, chunk_size=1000, chunk_overlap=200):
        # We start with recursive character text splitter which behaves semi-semantically.
        # Can be upgraded to SemanticChunker from langchain_experimental if OpenAI embeddings are used.
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ".", " ", ""]
        )

    def chunk_documents(self, parsed_elements):
        """
        Takes the unstructured parsed elements and chunks them, preserving metadata.
        """
        chunks = []
        for el in parsed_elements:
            if el["type"] in ["NarrativeText", "Title", "UncategorizedText", "text"]:
                text = el["text"]
                metadata = el.get("metadata", {})
                
                # Skip empty text
                if not text.strip():
                    continue
                
                split_texts = self.text_splitter.split_text(text)
                for split in split_texts:
                    chunks.append({
                        "content": split,
                        "metadata": metadata
                    })
        return chunks
