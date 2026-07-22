import 'dotenv/config';
import { PrismaClient, Plan, SubscriptionStatus, PaymentStatus, WorkspaceRole, InviteStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Clean up existing data ─────────────────────────────────────────────────
  await prisma.citation.deleteMany();
  await prisma.messageFeedback.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();
  await prisma.knowledgeBase.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.sharedLink.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Cleared existing data');

  // ─── Users ──────────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Password@123', 10);

  const alice = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@intellidoc.ai',
      password: hashedPassword,
      emailVerified: new Date(),
      role: 'user',
      plan: Plan.PRO,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notificationPrefs: { email: true, push: true },
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: 'Bob Martinez',
      email: 'bob@intellidoc.ai',
      password: hashedPassword,
      emailVerified: new Date(),
      role: 'user',
      plan: Plan.FREE,
      notificationPrefs: { email: true, push: false },
    },
  });

  const charlie = await prisma.user.create({
    data: {
      name: 'Charlie Kim',
      email: 'charlie@intellidoc.ai',
      password: hashedPassword,
      emailVerified: new Date(),
      role: 'user',
      plan: Plan.ENTERPRISE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      notificationPrefs: { email: false, push: true },
    },
  });

  // The existing ng61315@gmail.com user – update instead of recreate
  const nitin = await prisma.user.upsert({
    where: { email: 'ng61315@gmail.com' },
    update: {
      name: 'Nitin Gupta',
      emailVerified: new Date(),
      plan: Plan.PRO,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      name: 'Nitin Gupta',
      email: 'ng61315@gmail.com',
      password: hashedPassword,
      emailVerified: new Date(),
      role: 'user',
      plan: Plan.PRO,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Created users');

  // ─── Subscriptions ──────────────────────────────────────────────────────────
  await prisma.subscription.create({
    data: {
      userId: alice.id,
      plan: Plan.PRO,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.subscription.create({
    data: {
      userId: charlie.id,
      plan: Plan.ENTERPRISE,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.subscription.create({
    data: {
      userId: nitin.id,
      plan: Plan.PRO,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Created subscriptions');

  // ─── Payments ───────────────────────────────────────────────────────────────
  await prisma.payment.create({
    data: {
      userId: alice.id,
      razorpayOrderId: 'order_dummy_alice_001',
      razorpayPaymentId: 'pay_dummy_alice_001',
      amount: 49900,
      currency: 'INR',
      status: PaymentStatus.SUCCESS,
      plan: Plan.PRO,
      receipt: 'receipt_alice_001',
    },
  });

  await prisma.payment.create({
    data: {
      userId: charlie.id,
      razorpayOrderId: 'order_dummy_charlie_001',
      razorpayPaymentId: 'pay_dummy_charlie_001',
      amount: 199900,
      currency: 'INR',
      status: PaymentStatus.SUCCESS,
      plan: Plan.ENTERPRISE,
      receipt: 'receipt_charlie_001',
    },
  });

  await prisma.payment.create({
    data: {
      userId: nitin.id,
      razorpayOrderId: 'order_dummy_nitin_001',
      razorpayPaymentId: 'pay_dummy_nitin_001',
      amount: 49900,
      currency: 'INR',
      status: PaymentStatus.SUCCESS,
      plan: Plan.PRO,
      receipt: 'receipt_nitin_001',
    },
  });

  console.log('✅ Created payments');

  // ─── Workspaces ─────────────────────────────────────────────────────────────
  const wsAlice = await prisma.workspace.create({
    data: {
      name: "Alice's Research Hub",
      description: 'Central workspace for AI/ML research documents',
      ownerId: alice.id,
    },
  });

  const wsNitin = await prisma.workspace.create({
    data: {
      name: 'IntelliDoc Dev',
      description: 'Development workspace for IntelliDoc platform',
      ownerId: nitin.id,
    },
  });

  const wsCharlie = await prisma.workspace.create({
    data: {
      name: 'Enterprise Docs',
      description: 'Company-wide document management',
      ownerId: charlie.id,
    },
  });

  console.log('✅ Created workspaces');

  // ─── Workspace Members ──────────────────────────────────────────────────────
  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId: wsAlice.id, userId: alice.id, role: WorkspaceRole.OWNER },
      { workspaceId: wsAlice.id, userId: bob.id, role: WorkspaceRole.MEMBER },
      { workspaceId: wsAlice.id, userId: nitin.id, role: WorkspaceRole.ADMIN },
      { workspaceId: wsNitin.id, userId: nitin.id, role: WorkspaceRole.OWNER },
      { workspaceId: wsNitin.id, userId: alice.id, role: WorkspaceRole.MEMBER },
      { workspaceId: wsCharlie.id, userId: charlie.id, role: WorkspaceRole.OWNER },
      { workspaceId: wsCharlie.id, userId: bob.id, role: WorkspaceRole.ADMIN },
    ],
  });

  console.log('✅ Created workspace members');

  // ─── Folders ────────────────────────────────────────────────────────────────
  const folderResearch = await prisma.folder.create({
    data: { name: 'Research Papers', workspaceId: wsAlice.id },
  });

  const folderML = await prisma.folder.create({
    data: { name: 'Machine Learning', workspaceId: wsAlice.id, parentId: folderResearch.id },
  });

  const folderNLP = await prisma.folder.create({
    data: { name: 'NLP', workspaceId: wsAlice.id, parentId: folderResearch.id },
  });

  const folderDev = await prisma.folder.create({
    data: { name: 'Architecture Docs', workspaceId: wsNitin.id },
  });

  const folderReports = await prisma.folder.create({
    data: { name: 'Quarterly Reports', workspaceId: wsCharlie.id },
  });

  console.log('✅ Created folders');

  // ─── Knowledge Bases ────────────────────────────────────────────────────────
  const kbML = await prisma.knowledgeBase.create({
    data: {
      name: 'ML Research KB',
      description: 'Knowledge base for machine learning papers and notes',
      workspaceId: wsAlice.id,
    },
  });

  const kbDev = await prisma.knowledgeBase.create({
    data: {
      name: 'IntelliDoc Architecture',
      description: 'System design and API documentation',
      workspaceId: wsNitin.id,
    },
  });

  const kbEnterprise = await prisma.knowledgeBase.create({
    data: {
      name: 'Company Policies',
      description: 'HR policies, compliance docs, and guidelines',
      workspaceId: wsCharlie.id,
    },
  });

  console.log('✅ Created knowledge bases');

  // ─── Documents ──────────────────────────────────────────────────────────────
  const doc1 = await prisma.document.create({
    data: {
      workspaceId: wsAlice.id,
      uploadedBy: alice.id,
      filename: 'attention_is_all_you_need.pdf',
      mimeType: 'application/pdf',
      storageKey: 'docs/alice/attention_is_all_you_need.pdf',
      status: 'READY',
      progress: 100,
      currentStep: 'Complete',
      chunkCount: 48,
      embeddingModel: 'text-embedding-3-small',
      title: 'Attention Is All You Need',
      fileSize: 2048576,
      folderId: folderML.id,
      knowledgeBaseId: kbML.id,
      summary: 'The seminal transformer paper introducing the self-attention mechanism. Proposes a novel architecture dispensing with recurrence and convolutions entirely.',
      suggestedQuestions: [
        'What is the multi-head attention mechanism?',
        'How does positional encoding work in transformers?',
        'What are the advantages of transformers over RNNs?',
      ],
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      workspaceId: wsAlice.id,
      uploadedBy: alice.id,
      filename: 'bert_pretraining.pdf',
      mimeType: 'application/pdf',
      storageKey: 'docs/alice/bert_pretraining.pdf',
      status: 'READY',
      progress: 100,
      currentStep: 'Complete',
      chunkCount: 62,
      embeddingModel: 'text-embedding-3-small',
      title: 'BERT: Pre-training of Deep Bidirectional Transformers',
      fileSize: 3145728,
      folderId: folderNLP.id,
      knowledgeBaseId: kbML.id,
      summary: 'Introduces BERT, a method for pre-training language representations using masked language modeling and next sentence prediction.',
      suggestedQuestions: [
        'What is the masked language model objective?',
        'How does BERT differ from GPT?',
        'What downstream tasks benefit from BERT fine-tuning?',
      ],
    },
  });

  const doc3 = await prisma.document.create({
    data: {
      workspaceId: wsAlice.id,
      uploadedBy: bob.id,
      filename: 'rag_survey.pdf',
      mimeType: 'application/pdf',
      storageKey: 'docs/alice/rag_survey.pdf',
      status: 'READY',
      progress: 100,
      currentStep: 'Complete',
      chunkCount: 35,
      embeddingModel: 'text-embedding-3-small',
      title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
      fileSize: 1572864,
      folderId: folderNLP.id,
      knowledgeBaseId: kbML.id,
      summary: 'Introduces RAG, combining parametric and non-parametric memory for knowledge-intensive NLP tasks via dense passage retrieval.',
      suggestedQuestions: [
        'How does RAG combine retrieval and generation?',
        'What is DPR in the context of RAG?',
        'How does RAG handle factual grounding?',
      ],
    },
  });

  const doc4 = await prisma.document.create({
    data: {
      workspaceId: wsNitin.id,
      uploadedBy: nitin.id,
      filename: 'system_architecture.pdf',
      mimeType: 'application/pdf',
      storageKey: 'docs/nitin/system_architecture.pdf',
      status: 'READY',
      progress: 100,
      currentStep: 'Complete',
      chunkCount: 22,
      embeddingModel: 'text-embedding-3-small',
      title: 'IntelliDoc System Architecture v2',
      fileSize: 512000,
      folderId: folderDev.id,
      knowledgeBaseId: kbDev.id,
      summary: 'Comprehensive architecture document covering the microservices, data flow, and infrastructure setup for IntelliDoc.',
    },
  });

  const doc5 = await prisma.document.create({
    data: {
      workspaceId: wsNitin.id,
      uploadedBy: nitin.id,
      filename: 'api_reference.pdf',
      mimeType: 'application/pdf',
      storageKey: 'docs/nitin/api_reference.pdf',
      status: 'INGESTING',
      progress: 65,
      currentStep: 'Embedding chunks',
      title: 'IntelliDoc API Reference',
      fileSize: 768000,
      knowledgeBaseId: kbDev.id,
    },
  });

  const doc6 = await prisma.document.create({
    data: {
      workspaceId: wsCharlie.id,
      uploadedBy: charlie.id,
      filename: 'employee_handbook_2026.pdf',
      mimeType: 'application/pdf',
      storageKey: 'docs/charlie/employee_handbook_2026.pdf',
      status: 'READY',
      progress: 100,
      currentStep: 'Complete',
      chunkCount: 110,
      embeddingModel: 'text-embedding-3-small',
      title: 'Employee Handbook 2026',
      fileSize: 4194304,
      folderId: folderReports.id,
      knowledgeBaseId: kbEnterprise.id,
      summary: 'Complete HR handbook covering company policies, benefits, code of conduct, and onboarding procedures.',
    },
  });

  const doc7 = await prisma.document.create({
    data: {
      workspaceId: wsCharlie.id,
      uploadedBy: charlie.id,
      filename: 'q1_2026_report.pdf',
      mimeType: 'application/pdf',
      storageKey: 'docs/charlie/q1_2026_report.pdf',
      status: 'FAILED',
      progress: 30,
      errorMessage: 'Parsing failed: corrupted PDF structure at page 12',
      title: 'Q1 2026 Financial Report',
      fileSize: 2097152,
      folderId: folderReports.id,
    },
  });

  console.log('✅ Created documents');

  // ─── Chunks ─────────────────────────────────────────────────────────────────
  await prisma.chunk.createMany({
    data: [
      { documentId: doc1.id, text: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.' },
      { documentId: doc1.id, text: 'Attention mechanisms allow modeling of dependencies without regard to their distance in the input or output sequences.' },
      { documentId: doc1.id, text: 'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.' },
      { documentId: doc2.id, text: 'BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.' },
      { documentId: doc2.id, text: 'The masked language model randomly masks some of the tokens from the input, and the objective is to predict the original vocabulary id of the masked word based only on its context.' },
      { documentId: doc3.id, text: 'RAG combines a pre-trained seq2seq model (the generator) with a dense retrieval component to access documents from a non-parametric memory.' },
    ],
  });

  console.log('✅ Created chunks');

  // ─── Conversations ──────────────────────────────────────────────────────────
  const conv1 = await prisma.conversation.create({
    data: {
      workspaceId: wsAlice.id,
      userId: alice.id,
      title: 'Understanding Transformer Architecture',
      isPinned: true,
      knowledgeBaseId: kbML.id,
      documents: { connect: [{ id: doc1.id }] },
    },
  });

  const conv2 = await prisma.conversation.create({
    data: {
      workspaceId: wsAlice.id,
      userId: alice.id,
      title: 'BERT vs GPT comparison',
      knowledgeBaseId: kbML.id,
      documents: { connect: [{ id: doc2.id }] },
    },
  });

  const conv3 = await prisma.conversation.create({
    data: {
      workspaceId: wsAlice.id,
      userId: bob.id,
      title: 'RAG pipeline deep dive',
      knowledgeBaseId: kbML.id,
      documents: { connect: [{ id: doc3.id }] },
    },
  });

  const conv4 = await prisma.conversation.create({
    data: {
      workspaceId: wsNitin.id,
      userId: nitin.id,
      title: 'Architecture review session',
      knowledgeBaseId: kbDev.id,
      documents: { connect: [{ id: doc4.id }] },
    },
  });

  const conv5 = await prisma.conversation.create({
    data: {
      workspaceId: wsCharlie.id,
      userId: charlie.id,
      title: 'HR Policy Questions',
      knowledgeBaseId: kbEnterprise.id,
      documents: { connect: [{ id: doc6.id }] },
    },
  });

  console.log('✅ Created conversations');

  // ─── Messages ───────────────────────────────────────────────────────────────
  const msg2 = await prisma.message.create({
    data: {
      conversationId: conv1.id,
      role: 'USER',
      content: 'Can you explain how multi-head attention works in the Transformer architecture?',
    },
  });

  const msg3 = await prisma.message.create({
    data: {
      conversationId: conv1.id,
      role: 'ASSISTANT',
      content: 'Multi-head attention runs h attention functions in parallel, each on a different learned linear projection of the queries, keys, and values. The outputs are concatenated and projected again. This allows the model to jointly attend to information from different representation subspaces at different positions. The paper uses h=8 parallel attention heads with d_k = d_v = d_model/h = 64.',
      confidence: 0.96,
      faithfulness: 0.94,
      answerRelevancy: 0.97,
      contextPrecision: 0.91,
      contextRecall: 0.93,
      hallucinationScore: 0.04,
      hasWarning: false,
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conv1.id,
      role: 'USER',
      content: 'What is positional encoding and why is it needed?',
    },
  });

  const msg5 = await prisma.message.create({
    data: {
      conversationId: conv1.id,
      role: 'ASSISTANT',
      content: 'Since the Transformer contains no recurrence or convolution, positional encodings are added to give the model information about the relative or absolute position of tokens. The paper uses sine and cosine functions of different frequencies: PE(pos, 2i) = sin(pos/10000^(2i/d_model)) and PE(pos, 2i+1) = cos(...). This lets the model learn to attend by relative positions.',
      confidence: 0.93,
      faithfulness: 0.91,
      answerRelevancy: 0.95,
      contextPrecision: 0.88,
      contextRecall: 0.90,
      hallucinationScore: 0.06,
      hasWarning: false,
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conv2.id,
      role: 'USER',
      content: 'What is the key difference between BERT and GPT?',
    },
  });

  const msg7 = await prisma.message.create({
    data: {
      conversationId: conv2.id,
      role: 'ASSISTANT',
      content: 'The fundamental difference is directionality. GPT uses a left-to-right (causal) language model — each token only attends to previous tokens. BERT is bidirectional — through masked language modeling, every token can attend to all other tokens in both directions. This makes BERT better at understanding tasks (classification, NER, QA), while GPT is better suited for text generation.',
      confidence: 0.92,
      faithfulness: 0.89,
      answerRelevancy: 0.94,
      contextPrecision: 0.85,
      contextRecall: 0.88,
      hallucinationScore: 0.08,
      hasWarning: false,
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conv3.id,
      role: 'USER',
      content: "How does RAG handle knowledge that is not in the model's training data?",
    },
  });

  const msg9 = await prisma.message.create({
    data: {
      conversationId: conv3.id,
      role: 'ASSISTANT',
      content: 'RAG augments the generator with a retriever that fetches relevant documents from a non-parametric external memory (like a vector store). At inference time, the query is encoded, similar passages are retrieved via MIPS, and both the query and retrieved passages are fed to the generator. This lets the model access up-to-date or domain-specific knowledge without retraining.',
      confidence: 0.95,
      faithfulness: 0.93,
      answerRelevancy: 0.96,
      contextPrecision: 0.92,
      contextRecall: 0.91,
      hallucinationScore: 0.05,
      hasWarning: false,
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conv4.id,
      role: 'USER',
      content: 'What message broker does IntelliDoc use for async processing?',
    },
  });

  const msg11 = await prisma.message.create({
    data: {
      conversationId: conv4.id,
      role: 'ASSISTANT',
      content: 'Based on the architecture document, IntelliDoc uses RabbitMQ as the message broker for asynchronous document ingestion tasks. The AI service consumes jobs from queues and publishes status updates back to the Next.js server.',
      confidence: 0.82,
      faithfulness: 0.80,
      answerRelevancy: 0.85,
      contextPrecision: 0.78,
      contextRecall: 0.76,
      hallucinationScore: 0.18,
      hasWarning: true,
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conv5.id,
      role: 'USER',
      content: 'How many days of paid leave do employees get annually?',
    },
  });

  const msg13 = await prisma.message.create({
    data: {
      conversationId: conv5.id,
      role: 'ASSISTANT',
      content: 'According to the Employee Handbook 2026, full-time employees are entitled to 21 days of paid annual leave, in addition to 10 public holidays. Part-time employees receive leave on a pro-rata basis. Unused leave can be carried forward up to a maximum of 10 days per year.',
      confidence: 0.98,
      faithfulness: 0.97,
      answerRelevancy: 0.99,
      contextPrecision: 0.95,
      contextRecall: 0.96,
      hallucinationScore: 0.02,
      hasWarning: false,
    },
  });

  console.log('✅ Created messages');

  // ─── Citations ──────────────────────────────────────────────────────────────
  const doc1Chunk = await prisma.chunk.findFirst({ where: { documentId: doc1.id } });
  const doc2Chunk = await prisma.chunk.findFirst({ where: { documentId: doc2.id } });
  const doc3Chunk = await prisma.chunk.findFirst({ where: { documentId: doc3.id } });

  await prisma.citation.createMany({
    data: [
      {
        messageId: msg3.id,
        docId: doc1.id,
        chunkId: doc1Chunk!.id,
        pageNumber: 3,
        excerpt: 'Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions.',
      },
      {
        messageId: msg5.id,
        docId: doc1.id,
        chunkId: doc1Chunk!.id,
        pageNumber: 6,
        excerpt: 'Since our model contains no recurrence and no convolution, we must inject information about the relative or absolute position of the tokens in the sequence.',
      },
      {
        messageId: msg7.id,
        docId: doc2.id,
        chunkId: doc2Chunk!.id,
        pageNumber: 2,
        excerpt: 'BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context.',
      },
      {
        messageId: msg9.id,
        docId: doc3.id,
        chunkId: doc3Chunk!.id,
        pageNumber: 4,
        excerpt: 'RAG combines a pre-trained seq2seq model with a dense retrieval component to access documents from a non-parametric memory.',
      },
    ],
  });

  console.log('✅ Created citations');

  // ─── Message Feedback ─────────────────────────────────────────────────────
  await prisma.messageFeedback.createMany({
    data: [
      { messageId: msg3.id, rating: 'thumbs_up' },
      { messageId: msg7.id, rating: 'thumbs_up' },
      { messageId: msg9.id, rating: 'thumbs_up' },
      { messageId: msg11.id, rating: 'thumbs_down' },
      { messageId: msg13.id, rating: 'thumbs_up' },
    ],
  });

  console.log('✅ Created message feedback');

  // ─── Shared Links ─────────────────────────────────────────────────────────
  await prisma.sharedLink.createMany({
    data: [
      {
        token: 'sl_tok_transformer_doc_001',
        resourceId: doc1.id,
        resourceType: 'DOCUMENT',
        workspaceId: wsAlice.id,
        createdBy: alice.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accessCount: 14,
      },
      {
        token: 'sl_tok_rag_conv_001',
        resourceId: conv3.id,
        resourceType: 'CONVERSATION',
        workspaceId: wsAlice.id,
        createdBy: bob.id,
        accessCount: 3,
      },
      {
        token: 'sl_tok_hr_doc_001',
        resourceId: doc6.id,
        resourceType: 'DOCUMENT',
        workspaceId: wsCharlie.id,
        createdBy: charlie.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        accessCount: 57,
      },
    ],
  });

  console.log('✅ Created shared links');

  // ─── Invitations ─────────────────────────────────────────────────────────
  await prisma.invitation.createMany({
    data: [
      {
        workspaceId: wsAlice.id,
        email: 'david@example.com',
        role: WorkspaceRole.MEMBER,
        token: 'inv_tok_alice_david_001',
        status: InviteStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedBy: alice.id,
      },
      {
        workspaceId: wsCharlie.id,
        email: 'sara@example.com',
        role: WorkspaceRole.ADMIN,
        token: 'inv_tok_charlie_sara_001',
        status: InviteStatus.ACCEPTED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedBy: charlie.id,
      },
    ],
  });

  console.log('✅ Created invitations');

  console.log('\n🎉 Seeding complete! Summary:');
  console.log('   👤 4 Users  (alice, bob, charlie + ng61315@gmail.com)');
  console.log('   🏢 3 Workspaces with role-based membership');
  console.log('   📁 5 Folders  (2 nested under Research Papers)');
  console.log('   🧠 3 Knowledge Bases');
  console.log('   📄 7 Documents  (5 READY | 1 INGESTING | 1 FAILED)');
  console.log('   💬 5 Conversations with full Q&A threads');
  console.log('   📝 12 Messages with RAGAS scores');
  console.log('   🔖 4 Citations, 5 Feedback entries');
  console.log('   🔗 3 Shared links');
  console.log('   ✉️  2 Invitations');
  console.log('\n   🔑 All user passwords: Password@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
