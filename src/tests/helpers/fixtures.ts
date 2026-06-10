export function pdfFixture(): Buffer {
  // Minimal valid PDF structure that passes Multer MIME detection
  // Must start with %PDF- and end with %%EOF
  const content = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\n0000000000 65535 f\ntrailer\n<< /Size 1 >>\nstartxref\n9\n%%EOF';
  return Buffer.from(content, 'utf-8');
}

export function docxFixture(): Buffer {
  // Minimal valid ZIP (DOCX = ZIP) — must start with PK magic bytes
  // Use a pre-encoded base64 minimal ZIP string
  const minimalZipBase64 = 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';
  return Buffer.from(minimalZipBase64, 'base64');
}

export function txtFixture(content?: string): Buffer {
  return Buffer.from(
    content ?? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10),
    'utf-8'
  );
}

export function largeFileFixture(sizeBytes: number): Buffer {
  return Buffer.alloc(sizeBytes, 'x');
}

// Convenience: returns an object ready for supertest .attach()
export const fixtures = {
  pdf:   () => ({ buffer: pdfFixture(),  name: 'test-doc.pdf',  mime: 'application/pdf' }),
  docx:  () => ({ buffer: docxFixture(), name: 'test-doc.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
  txt:   () => ({ buffer: txtFixture(),  name: 'test-doc.txt',  mime: 'text/plain' }),
  large: (n: number) => ({ buffer: largeFileFixture(n), name: 'big.pdf', mime: 'application/pdf' }),
};
