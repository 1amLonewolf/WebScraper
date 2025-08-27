const { default: open } = require('open');
const path = require('path');

// Open the standalone report in the default browser
async function openReport() {
  try {
    const reportPath = path.join(__dirname, 'deals_report_standalone.html');
    await open(reportPath);
    console.log('Report opened in your default browser');
  } catch (error) {
    console.error('Error opening report:', error.message);
  }
}

// Run the function
openReport();