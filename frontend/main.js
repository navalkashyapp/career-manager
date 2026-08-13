import { 
  evaluateJob, 
  tailorResume, 
  processPortal, 
  batchEvaluate, 
  interviewPrep, 
  generateOutreach 
} from './src/services/ai.js';

const defaultInputs = {
  evaluateJob: `{
  "userProfile": {
    "targetRoles": ["Software Engineer"],
    "desiredCompensation": "$120k+",
    "coreSkills": ["JavaScript", "React", "Node.js"]
  },
  "jobDescription": "We are looking for a senior developer with 5+ years of React experience."
}`,
  tailorResume: `{
  "masterCvMarkdown": "# John Doe\\n\\n## Experience\\n- Frontend Developer at TechCorp (2020-2023)\\n  - Built React apps.",
  "jobDescription": "Looking for a React developer who knows Redux."
}`,
  processPortal: `{
  "domSnippet": "<div class='job-posting'><h1>Senior Engineer</h1><h4>Acme Corp</h4><p>San Francisco, CA</p><p>$150k - $180k</p><ul><li>5+ years React</li></ul></div>"
}`,
  batchEvaluate: `{
  "userProfile": {
    "targetRoles": ["Software Engineer"],
    "coreSkills": ["React"]
  },
  "jobs": [
    "Job 1: React Developer at Acme",
    "Job 2: Python Data Scientist at Globex"
  ]
}`,
  interviewPrep: `{
  "mode": "A",
  "userProfile": { "targetRoles": ["Frontend Engineer"] },
  "targetRole": "React Developer at Acme Corp",
  "interviewData": "Onsite interview in 3 days."
}`,
  generateOutreach: `{
  "userProfile": { "targetRoles": ["Software Engineer"] },
  "targetCompany": "Acme Corp",
  "targetContact": { "name": "Jane Smith", "role": "Engineering Manager" }
}`
};

let currentModule = 'evaluateJob';

// DOM Elements
const moduleList = document.querySelectorAll('#module-list li');
const currentModuleTitle = document.getElementById('current-module-title');
const jsonInput = document.getElementById('json-input');
const jsonOutput = document.getElementById('json-output');
const runBtn = document.getElementById('run-btn');
const btnText = document.querySelector('.btn-text');
const spinner = document.querySelector('.spinner');

// Setup Sidebar Listeners
moduleList.forEach(li => {
  li.addEventListener('click', (e) => {
    // Update active class
    moduleList.forEach(item => item.classList.remove('active'));
    e.target.classList.add('active');
    
    // Update state
    currentModule = e.target.getAttribute('data-module');
    currentModuleTitle.textContent = e.target.textContent;
    
    // Reset inputs/outputs
    jsonInput.value = defaultInputs[currentModule];
    jsonOutput.textContent = 'Ready to execute...';
    jsonOutput.style.color = '#569cd6';
  });
});

// Run Button Action
runBtn.addEventListener('click', async () => {
  // Set Loading State
  runBtn.disabled = true;
  btnText.classList.add('hidden');
  spinner.classList.remove('hidden');
  jsonOutput.textContent = 'Processing request via Gemini...';
  jsonOutput.style.color = '#9ba1a6';
  
  try {
    const inputData = JSON.parse(jsonInput.value);
    let result;

    switch (currentModule) {
      case 'evaluateJob':
        result = await evaluateJob(inputData.userProfile, inputData.jobDescription);
        break;
      case 'tailorResume':
        result = await tailorResume(inputData.masterCvMarkdown, inputData.jobDescription);
        break;
      case 'processPortal':
        result = await processPortal(inputData.domSnippet);
        break;
      case 'batchEvaluate':
        result = await batchEvaluate(inputData.userProfile, inputData.jobs);
        break;
      case 'interviewPrep':
        result = await interviewPrep(inputData.mode, inputData.userProfile, inputData.targetRole, inputData.interviewData);
        break;
      case 'generateOutreach':
        result = await generateOutreach(inputData.userProfile, inputData.targetCompany, inputData.targetContact);
        break;
      default:
        throw new Error('Unknown module selected');
    }
    
    // Format JSON with syntax highlighting in UI (simple color for stringification)
    jsonOutput.textContent = JSON.stringify(result, null, 2);
    jsonOutput.style.color = '#4ec9b0';
    
  } catch (error) {
    console.error('Execution error:', error);
    jsonOutput.textContent = `Error: ${error.message}\n\nMake sure your input is valid JSON and your Firebase config is set up correctly in src/firebase.js!`;
    jsonOutput.style.color = '#f14c4c';
  } finally {
    // Reset Loading State
    runBtn.disabled = false;
    btnText.classList.remove('hidden');
    spinner.classList.add('hidden');
  }
});
