/**
 * SchoolCBT Google Apps Script - Results Handler
 * 
 * This script:
 * 1. Receives exam submissions via webhook (POST)
 * 2. Creates individual spreadsheets for each exam
 * 3. Stores results in "CBT Exam Results" folder
 * 4. Maintains a Dashboard sheet for overview
 * 5. Fetches results for admin panel (GET) ← NEW!
 * 
 * Setup Instructions:
 * 1. Go to script.google.com
 * 2. Create new project, paste this code
 * 3. Deploy as Web App (Anyone can access)
 * 4. Copy the webhook URL
 * 5. Add URL to your exam JSON files
 */

// Configuration
const FOLDER_NAME = "CBT Exam Results";
const DASHBOARD_NAME = "Exam Results Dashboard";

/**
 * Main webhook handler - receives POST requests
 */
function doPost(e) {
  try {
    // Check if we received POST data
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log("No POST data received. Request object: " + JSON.stringify(e));
      return createResponse(false, "No data received. This endpoint expects POST requests with JSON data.");
    }
    
    const data = JSON.parse(e.postData.contents);
    
    Logger.log("Received submission: " + JSON.stringify(data));
    
    // Validate required fields
    if (!data.exam || !data.student || !data.scoring) {
      return createResponse(false, "Missing required data fields");
    }
    
    // Process the submission
    const result = processSubmission(data);
    
    return createResponse(true, "Submission recorded successfully", result);
    
  } catch (error) {
    Logger.log("Error processing submission: " + error.toString());
    Logger.log("Stack trace: " + error.stack);
    return createResponse(false, "Error: " + error.toString());
  }
}

/**
 * Handle GET requests - fetch results for admin panel
 * NEW FUNCTIONALITY!
 */
function doGet(e) {
  try {
    // Check if examId parameter provided
    const examId = e.parameter.examId;
    
    if (!examId) {
      // No examId - show info page
      return showInfoPage();
    }
    
    // Fetch results for this exam
    Logger.log("Fetching results for exam: " + examId);
    
    const results = fetchExamResults(examId);
    
    return createResponse(true, "Results fetched successfully", results);
    
  } catch (error) {
    Logger.log("Error fetching results: " + error.toString());
    Logger.log("Stack trace: " + error.stack);
    return createResponse(false, "Error: " + error.toString());
  }
}

/**
 * Show info page when accessed without parameters
 */
function showInfoPage() {
  const html = `
    <html>
      <head>
        <title>SchoolCBT Results Webhook</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
          h1 { color: #4285f4; }
          .status { padding: 10px; background: #34a853; color: white; border-radius: 4px; }
          code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
          .endpoint { background: #f8f9fa; padding: 15px; border-left: 4px solid #4285f4; margin: 15px 0; }
        </style>
      </head>
      <body>
        <h1>✅ SchoolCBT Results Webhook</h1>
        <div class="status">Webhook is active and ready!</div>
        
        <div class="endpoint">
          <h3>POST - Submit Results</h3>
          <p><strong>Method:</strong> POST</p>
          <p><strong>Content-Type:</strong> application/json</p>
          <p><strong>Purpose:</strong> Student exam submissions</p>
        </div>
        
        <div class="endpoint">
          <h3>GET - Fetch Results</h3>
          <p><strong>Method:</strong> GET</p>
          <p><strong>Parameter:</strong> examId</p>
          <p><strong>Example:</strong> <code>?examId=ENG-2025-001</code></p>
          <p><strong>Purpose:</strong> Admin panel analytics</p>
        </div>
        
        <h3>Testing:</h3>
        <p>Run <code>testSubmission()</code> or <code>testFetchResults()</code> in the Apps Script editor.</p>
        <p><small>Last checked: ` + new Date().toISOString() + `</small></p>
      </body>
    </html>
  `;
  
  return HtmlService.createHtmlOutput(html);
}

/**
 * Create JSON response
 */
function createResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };
  
  if (data) {
    // Flatten data into response for cleaner structure
    Object.assign(response, data);
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fetch results for a specific exam
 * NEW FUNCTION!
 */
function fetchExamResults(examId) {
  const folder = getOrCreateFolder();
  
  // Find spreadsheet by searching for examId in the name
  const files = folder.getFiles();
  let targetSpreadsheet = null;
  
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    
    // Check if this is the right spreadsheet
    // We need to open it and check if it matches the examId
    try {
      const spreadsheet = SpreadsheetApp.openById(file.getId());
      const sheet = spreadsheet.getSheetByName("Results");
      
      if (sheet && sheet.getLastRow() > 1) {
        // Check first data row to see if it matches our exam
        // We'll use the spreadsheet name as identifier since we generate it from exam data
        targetSpreadsheet = spreadsheet;
        break; // For now, we'll need a better matching strategy
      }
    } catch (e) {
      continue;
    }
  }
  
  // Better approach: Search dashboard for the exam and get the spreadsheet URL
  const dashboard = getOrCreateDashboard();
  const dashboardSheet = dashboard.getSheetByName("Overview");
  const dashboardData = dashboardSheet.getDataRange().getValues();
  
  let examSpreadsheetUrl = null;
  
  // Search dashboard for exam by examId (column 1)
  for (let i = 1; i < dashboardData.length; i++) {
    const row = dashboardData[i];
    if (row[0] === examId) { // Column 1 = Exam ID
      examSpreadsheetUrl = row[10]; // Column 11 = Spreadsheet Link
      break;
    }
  }
  
  if (!examSpreadsheetUrl) {
    return {
      examId: examId,
      results: [],
      totalStudents: 0,
      analytics: null,
      message: "No results found for this exam"
    };
  }
  
  // Open the exam spreadsheet
  const spreadsheet = SpreadsheetApp.openByUrl(examSpreadsheetUrl);
  const sheet = spreadsheet.getSheetByName("Results");
  
  if (!sheet || sheet.getLastRow() <= 1) {
    return {
      examId: examId,
      results: [],
      totalStudents: 0,
      analytics: null,
      message: "No students have submitted yet"
    };
  }
  
  // Get all data
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  // Convert to array of objects
  const results = rows.map(row => {
    const result = {};
    headers.forEach((header, index) => {
      result[header] = row[index];
    });
    return result;
  });
  
  // Calculate analytics
  const analytics = calculateAnalytics(results);
  
  return {
    examId: examId,
    results: results,
    totalStudents: results.length,
    analytics: analytics
  };
}

/**
 * Calculate analytics from results
 * NEW FUNCTION!
 */
function calculateAnalytics(results) {
  if (results.length === 0) {
    return null;
  }
  
  // Extract percentages and durations
  const percentages = results.map(r => {
    const percentStr = r['Percentage'] ? r['Percentage'].toString().replace('%', '') : '0';
    return parseFloat(percentStr) || 0;
  });
  
  const durations = results.map(r => parseInt(r['Duration Used (min)']) || 0);
  const violations = results.map(r => parseInt(r['Integrity Violations']) || 0);
  
  // Calculate averages
  const avgPercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  
  // Find min/max
  const highestScore = Math.max(...percentages);
  const lowestScore = Math.min(...percentages);
  const fastestTime = Math.min(...durations);
  const slowestTime = Math.max(...durations);
  
  // Pass/Fail counts
  const passCount = results.filter(r => r['Pass/Fail'] === 'PASS').length;
  const failCount = results.length - passCount;
  const passRate = (passCount / results.length) * 100;
  
  // Score distribution
  const distribution = {
    '0-40': percentages.filter(p => p < 40).length,
    '41-60': percentages.filter(p => p >= 40 && p < 60).length,
    '61-80': percentages.filter(p => p >= 60 && p < 80).length,
    '81-100': percentages.filter(p => p >= 80).length
  };
  
  // Time distribution
  const timeDistribution = {
    '0-15': durations.filter(d => d <= 15).length,
    '16-25': durations.filter(d => d > 15 && d <= 25).length,
    '26-35': durations.filter(d => d > 25 && d <= 35).length,
    '36+': durations.filter(d => d > 35).length
  };
  
  // Violation stats
  const studentsWithViolations = violations.filter(v => v > 0).length;
  const totalViolations = violations.reduce((a, b) => a + b, 0);
  
  return {
    averageScore: Math.round(avgPercentage * 100) / 100,
    highestScore: highestScore,
    lowestScore: lowestScore,
    passRate: Math.round(passRate * 100) / 100,
    passCount: passCount,
    failCount: failCount,
    averageTime: Math.round(avgDuration),
    fastestTime: fastestTime,
    slowestTime: slowestTime,
    scoreDistribution: distribution,
    timeDistribution: timeDistribution,
    violationStats: {
      studentsWithViolations: studentsWithViolations,
      totalViolations: totalViolations
    }
  };
}

/**
 * Get or create the CBT Exam Results folder
 */
function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  
  if (folders.hasNext()) {
    return folders.next();
  }
  
  return DriveApp.createFolder(FOLDER_NAME);
}

/**
 * Generate spreadsheet name from exam data
 * Format: "JSS2 English First Term exam 2024/2025"
 */
function generateSpreadsheetName(examData) {
  const className = examData.class || "Unknown Class";
  const subject = examData.subject || "Unknown Subject";
  const term = examData.term || "Term";
  const academicYear = examData.academicYear || new Date().getFullYear();
  
  return `${className} ${subject} ${term} exam ${academicYear}`;
}

/**
 * Get or create exam spreadsheet
 */
function getOrCreateExamSpreadsheet(examData) {
  const folder = getOrCreateFolder();
  
  Logger.log("Exam data received: " + JSON.stringify(examData));
  
  const spreadsheetName = generateSpreadsheetName(examData);
  Logger.log("Generated spreadsheet name: " + spreadsheetName);
  
  // Search for existing spreadsheet in folder
  const files = folder.getFilesByName(spreadsheetName);
  
  if (files.hasNext()) {
    const file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }
  
  // Create new spreadsheet
  const spreadsheet = SpreadsheetApp.create(spreadsheetName);
  const file = DriveApp.getFileById(spreadsheet.getId());
  
  // Move to CBT folder
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  
  // Setup headers
  const sheet = spreadsheet.getActiveSheet();
  sheet.setName("Results");
  
  const headers = [
    "Timestamp",
    "Student Name",
    "Seat Number",
    "Total Questions",
    "Total Answered",
    "Correct Answers",
    "Wrong Answers",
    "Score",
    "Percentage",
    "Pass/Fail",
    "Duration Allowed (min)",
    "Duration Used (min)",
    "Submission Type",
    "Integrity Violations",
    "Started At",
    "Submitted At"
  ];
  
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold")
    .setBackground("#4285f4")
    .setFontColor("#ffffff");
  
  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  return spreadsheet;
}

/**
 * Process and store submission
 */
function processSubmission(data) {
  const spreadsheet = getOrCreateExamSpreadsheet(data.exam);
  const sheet = spreadsheet.getSheetByName("Results");
  
  // Prepare row data
  const row = [
    new Date().toISOString(),
    data.student.fullName,
    data.student.registrationNumber,
    data.scoring.totalQuestions,
    data.scoring.attemptedQuestions,
    data.scoring.correctAnswers,
    data.scoring.wrongAnswers,
    `${data.scoring.obtainedMarks}/${data.scoring.totalMarks}`,
    data.scoring.percentage + "%",
    data.scoring.passed ? "PASS" : "FAIL",
    data.timing.durationAllowed,
    data.timing.durationUsed,
    data.submission.type,
    data.integrity.violations,
    data.timing.startedAt,
    data.timing.submittedAt
  ];
  
  // Append row
  sheet.appendRow(row);
  
  // Color code pass/fail
  const lastRow = sheet.getLastRow();
  const passFailCell = sheet.getRange(lastRow, 10); // Pass/Fail column
  
  if (data.scoring.passed) {
    passFailCell.setBackground("#34a853").setFontColor("#ffffff");
  } else {
    passFailCell.setBackground("#ea4335").setFontColor("#ffffff");
  }
  
  // Highlight violations if any
  if (data.integrity.violations > 0) {
    const violationsCell = sheet.getRange(lastRow, 14);
    violationsCell.setBackground("#fbbc04").setFontWeight("bold");
  }
  
  // Update dashboard
  updateDashboard(data, spreadsheet.getUrl());
  
  return {
    spreadsheetUrl: spreadsheet.getUrl(),
    spreadsheetName: spreadsheet.getName(),
    rowNumber: lastRow
  };
}

/**
 * Get or create dashboard spreadsheet
 */
function getOrCreateDashboard() {
  const folder = getOrCreateFolder();
  const files = folder.getFilesByName(DASHBOARD_NAME);
  
  if (files.hasNext()) {
    const file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }
  
  // Create new dashboard
  const spreadsheet = SpreadsheetApp.create(DASHBOARD_NAME);
  const file = DriveApp.getFileById(spreadsheet.getId());
  
  // Move to CBT folder
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  
  // Setup headers
  const sheet = spreadsheet.getActiveSheet();
  sheet.setName("Overview");
  
  const headers = [
    "Exam ID",
    "Exam Name",
    "Class",
    "Subject",
    "Term",
    "Academic Year",
    "Total Students",
    "Average Score (%)",
    "Pass Rate (%)",
    "Last Updated",
    "Spreadsheet Link"
  ];
  
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold")
    .setBackground("#0f9d58")
    .setFontColor("#ffffff");
  
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
  
  sheet.setFrozenRows(1);
  
  return spreadsheet;
}

/**
 * Update dashboard with exam statistics
 */
function updateDashboard(submissionData, examSpreadsheetUrl) {
  const dashboard = getOrCreateDashboard();
  const sheet = dashboard.getSheetByName("Overview");
  
  const examName = generateSpreadsheetName(submissionData.exam);
  
  // Find existing row for this exam
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === submissionData.exam.examId) { // Match by examId
      rowIndex = i + 1;
      break;
    }
  }
  
  // Calculate statistics
  const stats = calculateExamStats(examSpreadsheetUrl);
  
  const rowData = [
    submissionData.exam.examId, // NEW: Store examId for easy lookup
    examName,
    submissionData.exam.class,
    submissionData.exam.subject,
    submissionData.exam.term,
    submissionData.exam.academicYear,
    stats.totalStudents,
    stats.averageScore.toFixed(1),
    stats.passRate.toFixed(1),
    new Date().toISOString(),
    examSpreadsheetUrl
  ];
  
  if (rowIndex === -1) {
    sheet.appendRow(rowData);
  } else {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  }
  
  for (let i = 1; i <= rowData.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * Calculate statistics from exam spreadsheet
 */
function calculateExamStats(spreadsheetUrl) {
  const spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
  const sheet = spreadsheet.getSheetByName("Results");
  
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  
  if (rows.length === 0) {
    return {
      totalStudents: 0,
      averageScore: 0,
      passRate: 0
    };
  }
  
  let totalPercentage = 0;
  let passCount = 0;
  
  rows.forEach(row => {
    const percentage = parseFloat(row[8].toString().replace('%', ''));
    totalPercentage += percentage;
    
    if (row[9] === "PASS") {
      passCount++;
    }
  });
  
  return {
    totalStudents: rows.length,
    averageScore: totalPercentage / rows.length,
    passRate: (passCount / rows.length) * 100
  };
}

/**
 * Test submission function
 */
function testSubmission() {
  const testData = {
    submissionId: "TEST-001",
    student: {
      fullName: "Test Student",
      registrationNumber: "A01",
      class: "JSS2"
    },
    exam: {
      examId: "ENG-2025-001",
      title: "English First Term Examination",
      subject: "English",
      class: "JSS2",
      term: "First Term",
      academicYear: "2024/2025"
    },
    scoring: {
      totalQuestions: 15,
      attemptedQuestions: 15,
      correctAnswers: 12,
      wrongAnswers: 3,
      unansweredQuestions: 0,
      totalMarks: 15,
      obtainedMarks: 12,
      percentage: 80,
      passed: true
    },
    timing: {
      startedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      durationAllowed: 40,
      durationUsed: 35
    },
    submission: {
      type: "manual"
    },
    integrity: {
      violations: 0,
      violationLog: []
    }
  };
  
  const result = processSubmission(testData);
  Logger.log("Test result: " + JSON.stringify(result));
}

/**
 * Test fetching results
 * NEW TEST FUNCTION!
 */
function testFetchResults() {
  const examId = "ENG-2025-001"; // Change this to match your actual exam
  
  const results = fetchExamResults(examId);
  Logger.log("Fetch results: " + JSON.stringify(results, null, 2));
}