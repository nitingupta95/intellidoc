import boto3
from langchain_community.document_loaders import PyPDFLoader

s3 = boto3.client(
    's3',
    endpoint_url='http://localhost:9000',
    aws_access_key_id='admin',
    aws_secret_access_key='password',
    region_name='us-east-1'
)

s3.download_file('intellidoc-documents', 'cmq6g4qwp0002rwrywfr5sew9/1780998497458-Tips_for_Users_of_Assistive_Technology__1___1___1___1___1_.pdf', 'test_tips.pdf')

loader = PyPDFLoader('test_tips.pdf')
docs = loader.load()
print(f"Loaded {len(docs)} pages")
if docs:
    print(f"First page length: {len(docs[0].page_content)}")
    print(f"First page text: {docs[0].page_content[:100]}")
else:
    print("No docs loaded")
