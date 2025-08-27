const { default: open } = require('open');
const path = require('path');

// Open the HTML report in the default browser
async function openReport() {
  try {
    const reportPath = path.join(__dirname, 'docs', 'index.html');
    await open(reportPath);
    console.log('Report opened in your default browser');
  } catch (error) {
    console.error('Error opening report:', error.message);
  }
}

// Run the function
openReport();