// TODO(backend): Replace all mock data with API calls

const now = Date.now();
const hour = 3600000;
const day = 86400000;

export const mockConversations = [
  // --- Today ---
  {
    id: 'conv-1',
    title: 'Understanding my blood test results',
    createdAt: now - 2 * hour,
    updatedAt: now - 2 * hour,
    messageCount: 6,
  },
  {
    id: 'conv-2',
    title: 'Ibuprofen and blood pressure medication',
    createdAt: now - 5 * hour,
    updatedAt: now - 4 * hour,
    messageCount: 4,
  },
  {
    id: 'conv-3',
    title: 'What does a high CRP level mean?',
    createdAt: now - 8 * hour,
    updatedAt: now - 7 * hour,
    messageCount: 3,
  },
  // --- Previous 7 days ---
  {
    id: 'conv-4',
    title: 'Preparing for a cardiology appointment',
    createdAt: now - 2 * day,
    updatedAt: now - 2 * day,
    messageCount: 8,
  },
  {
    id: 'conv-5',
    title: 'Difference between type 1 and type 2 diabetes',
    createdAt: now - 3 * day,
    updatedAt: now - 3 * day,
    messageCount: 5,
  },
  {
    id: 'conv-6',
    title: 'Side effects of metformin',
    createdAt: now - 4 * day,
    updatedAt: now - 4 * day,
    messageCount: 4,
  },
  {
    id: 'conv-7',
    title: 'Is intermittent fasting safe?',
    createdAt: now - 5 * day,
    updatedAt: now - 5 * day,
    messageCount: 6,
  },
  // --- Older ---
  {
    id: 'conv-8',
    title: 'Managing seasonal allergies',
    createdAt: now - 10 * day,
    updatedAt: now - 10 * day,
    messageCount: 3,
  },
  {
    id: 'conv-9',
    title: 'Understanding a thyroid panel',
    createdAt: now - 15 * day,
    updatedAt: now - 15 * day,
    messageCount: 7,
  },
  {
    id: 'conv-10',
    title: 'When to see a dermatologist',
    createdAt: now - 20 * day,
    updatedAt: now - 20 * day,
    messageCount: 4,
  },
  {
    id: 'conv-11',
    title: 'Interpreting an ECG report',
    createdAt: now - 30 * day,
    updatedAt: now - 30 * day,
    messageCount: 5,
  },
  {
    id: 'conv-12',
    title: 'Vitamin D deficiency symptoms',
    createdAt: now - 35 * day,
    updatedAt: now - 35 * day,
    messageCount: 3,
  },
];

export const mockMessages = {
  'conv-1': [
    {
      id: 'msg-1-1',
      role: 'user',
      content: 'I just got my blood test results back and I\'m not sure what some of the values mean. My hemoglobin is 13.2 g/dL and my white blood cell count is 7,500/mcL. Are these normal?',
      timestamp: now - 2 * hour,
    },
    {
      id: 'msg-1-2',
      role: 'assistant',
      content: 'Based on the values you\'ve shared, both appear to be within commonly referenced normal ranges:\n\n**Hemoglobin (13.2 g/dL)**\n- Normal range for adult males: 13.5 to 17.5 g/dL\n- Normal range for adult females: 12.0 to 16.0 g/dL\n\nYour value of 13.2 g/dL falls within the normal range for females. If you\'re male, it\'s slightly below the typical lower limit, which your doctor may want to discuss.\n\n**White Blood Cell Count (7,500/mcL)**\n- Normal range: 4,500 to 11,000/mcL\n\nThis is well within the normal range and suggests your immune system is functioning as expected.\n\nKeep in mind that \"normal\" ranges can vary slightly between laboratories, so it\'s always best to review your results with your healthcare provider who can interpret them in the context of your full medical history.',
      timestamp: now - 2 * hour + 15000,
      sources: [
        { id: 1, title: 'Mayo Clinic — Complete Blood Count', url: '#' },
        { id: 2, title: 'MedlinePlus — Blood Count Tests', url: '#' },
      ],
    },
    {
      id: 'msg-1-3',
      role: 'user',
      content: 'What about my cholesterol? Total cholesterol is 215 mg/dL and LDL is 140 mg/dL.',
      timestamp: now - 2 * hour + 60000,
    },
    {
      id: 'msg-1-4',
      role: 'assistant',
      content: 'Here\'s how your cholesterol values compare to general guidelines:\n\n**Total Cholesterol (215 mg/dL)**\n- Desirable: below 200 mg/dL\n- Borderline high: 200 to 239 mg/dL\n- High: 240 mg/dL and above\n\nYour total cholesterol of 215 mg/dL falls in the **borderline high** category.\n\n**LDL Cholesterol (140 mg/dL)**\n- Optimal: below 100 mg/dL\n- Near optimal: 100 to 129 mg/dL\n- Borderline high: 130 to 159 mg/dL\n- High: 160 to 189 mg/dL\n\nYour LDL of 140 mg/dL is in the **borderline high** range.\n\nThese numbers alone don\'t determine cardiovascular risk. Your doctor will consider additional factors such as your HDL level, triglycerides, blood pressure, family history, and lifestyle. This is a conversation worth having at your next appointment.',
      timestamp: now - 2 * hour + 90000,
      sources: [
        { id: 1, title: 'American Heart Association — Cholesterol Levels', url: '#' },
        { id: 2, title: 'NIH — High Blood Cholesterol', url: '#' },
        { id: 3, title: 'CDC — Cholesterol Fact Sheet', url: '#' },
      ],
    },
    {
      id: 'msg-1-5',
      role: 'user',
      content: 'Should I be worried about the cholesterol numbers?',
      timestamp: now - 2 * hour + 150000,
    },
    {
      id: 'msg-1-6',
      role: 'assistant',
      content: 'Borderline high cholesterol is common and, in many cases, manageable through lifestyle changes. It\'s not a reason for alarm, but it is worth paying attention to.\n\nCommon approaches your doctor might suggest include:\n\n- **Dietary adjustments** — reducing saturated fat, increasing fiber, incorporating omega-3 fatty acids\n- **Regular physical activity** — at least 150 minutes of moderate exercise per week\n- **Weight management** — if applicable\n- **Medication** — statins or other lipid-lowering drugs, if lifestyle changes aren\'t sufficient\n\nThe most important next step is discussing these results with your healthcare provider, who can assess your overall cardiovascular risk profile and recommend a personalized plan.',
      timestamp: now - 2 * hour + 180000,
      sources: [
        { id: 1, title: 'Mayo Clinic — High Cholesterol Treatment', url: '#' },
      ],
    },
  ],
  'conv-2': [
    {
      id: 'msg-2-1',
      role: 'user',
      content: 'Can I take ibuprofen if I\'m already on lisinopril for blood pressure?',
      timestamp: now - 5 * hour,
    },
    {
      id: 'msg-2-2',
      role: 'assistant',
      content: 'This is an important question to raise with your prescribing physician. Here is what is generally understood about this combination:\n\n**Potential interaction:** NSAIDs like ibuprofen can reduce the effectiveness of ACE inhibitors like lisinopril. They may also increase the risk of kidney problems when used together, particularly in patients who are dehydrated or have pre-existing kidney conditions.\n\n**Mechanism:** Ibuprofen can cause sodium and water retention, which works against the blood-pressure-lowering effect of lisinopril. Both drugs also affect kidney blood flow through different pathways, and combining them can reduce the kidney\'s ability to regulate itself.\n\n**What to do:**\n- For occasional pain relief, your doctor may suggest **acetaminophen (paracetamol)** as an alternative that doesn\'t carry the same interaction risk\n- If you need anti-inflammatory medication specifically, discuss the duration and dosage with your doctor\n- Never stop or change your blood pressure medication without medical guidance\n\nThis is a well-documented interaction, not a rare edge case, so your pharmacist or doctor will be familiar with it.',
      timestamp: now - 5 * hour + 20000,
      sources: [
        { id: 1, title: 'FDA — Drug Interaction Guide', url: '#' },
        { id: 2, title: 'British National Formulary — ACE Inhibitors', url: '#' },
      ],
    },
    {
      id: 'msg-2-3',
      role: 'user',
      content: 'What about aspirin? Is that safe with lisinopril?',
      timestamp: now - 4 * hour,
    },
    {
      id: 'msg-2-4',
      role: 'assistant',
      content: 'Low-dose aspirin (typically 75 to 100 mg daily) is often prescribed alongside ACE inhibitors like lisinopril, particularly for patients with a history of cardiovascular events. At these doses, the interaction with blood pressure medication is generally considered minimal.\n\nHowever, **higher doses of aspirin** (above 300 mg) can have a similar effect to ibuprofen in reducing the blood-pressure-lowering action of ACE inhibitors.\n\nKey points:\n- Low-dose aspirin for cardiovascular prevention is usually compatible with lisinopril\n- Pain-relief doses of aspirin (600 mg or more) carry the same concerns as ibuprofen\n- Your doctor has likely already accounted for this if both have been prescribed to you\n\nAs always, confirm with your healthcare provider before adding any over-the-counter medication to your routine.',
      timestamp: now - 4 * hour + 15000,
      sources: [
        { id: 1, title: 'NICE Guidelines — Hypertension Management', url: '#' },
      ],
    },
  ],
};

// Canned responses for mock message sending
// TODO(backend): Replace with actual AI response generation
export const cannedResponses = [
  'Thank you for your question. Based on general medical knowledge, I can offer some information that may be helpful.\n\nPlease keep in mind that this is general health information and should not replace a consultation with your healthcare provider, who can give you advice specific to your medical history and circumstances.\n\nI would recommend discussing this topic at your next appointment, or contacting your doctor\'s office if you have immediate concerns.',
  'That\'s a thoughtful question. Here\'s what is generally understood:\n\nMedical research in this area suggests several factors to consider. Individual responses can vary significantly, so what applies broadly may not apply to your specific situation.\n\n**Next steps I\'d suggest:**\n- Note down any symptoms you\'re experiencing, including when they started\n- Keep a record of any medications or supplements you\'re currently taking\n- Bring these notes to your next healthcare appointment\n\nYour doctor will be best positioned to evaluate this in context.',
  'I can share some general information about this topic.\n\nIt\'s worth noting that symptoms can have many possible causes, and an accurate assessment requires a proper clinical evaluation. What I can provide here is background information to help you have a more informed conversation with your healthcare provider.\n\n**General considerations:**\n1. Duration and pattern of symptoms matter for diagnosis\n2. Associated symptoms can help narrow down possible causes\n3. Your medical and family history provide important context\n\nIf your symptoms are severe, worsening, or accompanied by warning signs like difficulty breathing, chest pain, or sudden changes in vision, seek immediate medical attention.',
];
