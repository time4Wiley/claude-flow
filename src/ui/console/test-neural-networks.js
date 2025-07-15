/* eslint-env browser */
/**
 * Neural Networks Dialog Test Script
 * Tests all functionality of the neural networks panel
 */

// Test report object
const _testReport = {
  timestamp: new Date().toISOString(),
  passed: [],
  failed: [],
  warnings: []
};

// Helper function to log test results
function logTest(_name, _passed, message = '') {
  if (passed) {
    testReport.passed.push(name);
    console.log(`✅ ${name}`);
  } else {
    testReport.failed.push({ _name, message });
    console.error(`❌ ${name}: ${message}`);
  }
}

// Helper function to log warnings
function logWarning(message) {
  testReport.warnings.push(message);
  console.warn(`⚠️ ${message}`);
}

// Test 1: Check if neural networks panel exists
function testPanelExists() {
  const _panel = document.getElementById('neuralNetworksPanel');
  logTest('Neural Networks Panel Exists', !!_panel, panel ? '' : 'Panel element not found');
  return !!panel;
}

// Test 2: Check if toggle button exists
function testToggleButton() {
  const _button = document.getElementById('neuralToggle');
  logTest('Neural Toggle Button Exists', !!_button, button ? '' : 'Toggle button not found');
  return !!button;
}

// Test 3: Test panel toggle functionality
function testPanelToggle() {
  const _button = document.getElementById('neuralToggle');
  const _panel = document.getElementById('neuralNetworksPanel');
  
  if (!button || !panel) {
    logTest('Panel Toggle Functionality', _false, 'Required elements not found');
    return false;
  }
  
  // Check initial state
  const _initiallyHidden = panel.classList.contains('hidden');
  
  // Click to toggle
  button.click();
  
  // Check if state changed
  const _afterClickHidden = panel.classList.contains('hidden');
  const _toggled = initiallyHidden !== afterClickHidden;
  
  logTest('Panel Toggle Functionality', _toggled, toggled ? '' : 'Panel did not toggle');
  
  // If panel is now visible, keep it open for further tests
  if (afterClickHidden) {
    button.click();
  }
  
  return toggled;
}

// Test 4: Check all tabs exist and can be switched
function testTabSwitching() {
  const _tabs = ['tools', 'training', 'models', 'patterns', 'performance'];
  let _allTabsWork = true;
  
  tabs.forEach(tabName => {
    const _tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    const _tabContent = document.querySelector(`.neural-tab-content[data-tab="${tabName}"]`);
    
    if (!tabButton || !tabContent) {
      logTest(`Tab "${tabName}" exists`, _false, 'Tab button or content not found');
      allTabsWork = false;
      return;
    }
    
    // Click the tab
    tabButton.click();
    
    // Check if tab is active
    const _isActive = tabButton.classList.contains('active') && tabContent.classList.contains('active');
    logTest(`Tab "${tabName}" switching`, _isActive, isActive ? '' : 'Tab did not activate properly');
    
    if (!isActive) allTabsWork = false;
  });
  
  return allTabsWork;
}

// Test 5: Check tool cards and their buttons
function testToolCards() {
  // Switch to tools tab first
  const _toolsTab = document.querySelector('[data-tab="tools"]');
  if (toolsTab) toolsTab.click();
  
  const _toolCards = document.querySelectorAll('.neural-tool-card');
  logTest('Tool cards exist', toolCards.length > _0, `Found ${toolCards.length} tool cards`);
  
  if (toolCards.length === 0) return false;
  
  let _allButtonsWork = true;
  toolCards.forEach((_card, index) => {
    const _executeBtn = card.querySelector('[data-action="execute"]');
    const _configureBtn = card.querySelector('[data-action="configure"]');
    
    if (!executeBtn || !configureBtn) {
      logWarning(`Tool card ${index} missing buttons`);
      allButtonsWork = false;
    }
  });
  
  logTest('All tool cards have buttons', allButtonsWork);
  return allButtonsWork;
}

// Test 6: Check training controls
function testTrainingControls() {
  // Switch to training tab
  const _trainingTab = document.querySelector('[data-tab="training"]');
  if (trainingTab) trainingTab.click();
  
  const _controls = {
    'Training Type Select': document.getElementById('trainingType'),
    'Training Data Textarea': document.getElementById('trainingData'),
    'Epochs Input': document.getElementById('trainingEpochs'),
    'Learning Rate Input': document.getElementById('learningRate'),
    'Start Training Button': document.getElementById('startTraining'),
    'Stop Training Button': document.getElementById('stopTraining')
  };
  
  let _allControlsExist = true;
  Object.entries(controls).forEach(([_name, element]) => {
    const _exists = !!element;
    logTest(`${name} exists`, _exists, exists ? '' : 'Control not found');
    if (!exists) allControlsExist = false;
  });
  
  return allControlsExist;
}

// Test 7: Check model management controls
function testModelControls() {
  // Switch to models tab
  const _modelsTab = document.querySelector('[data-tab="models"]');
  if (modelsTab) modelsTab.click();
  
  const _loadButton = document.getElementById('loadModel');
  const _createButton = document.getElementById('createModel');
  const _modelsGrid = document.getElementById('modelsGrid');
  
  logTest('Load Model button exists', !!loadButton);
  logTest('Create Model button exists', !!createButton);
  logTest('Models Grid exists', !!modelsGrid);
  
  return !!(loadButton && createButton && modelsGrid);
}

// Test 8: Check pattern analysis controls
function testPatternControls() {
  // Switch to patterns tab
  const _patternsTab = document.querySelector('[data-tab="patterns"]');
  if (patternsTab) patternsTab.click();
  
  const _analyzeButton = document.getElementById('analyzePatterns');
  const _recognizeButton = document.getElementById('recognizePatterns');
  const _behaviorButton = document.getElementById('analyzeBehavior');
  const _behaviorInput = document.getElementById('behaviorInput');
  
  logTest('Analyze Patterns button exists', !!analyzeButton);
  logTest('Recognize Patterns button exists', !!recognizeButton);
  logTest('Analyze Behavior button exists', !!behaviorButton);
  logTest('Behavior Input exists', !!behaviorInput);
  
  return !!(analyzeButton && recognizeButton && behaviorButton && behaviorInput);
}

// Test 9: Check performance controls
function testPerformanceControls() {
  // Switch to performance tab
  const _performanceTab = document.querySelector('[data-tab="performance"]');
  if (performanceTab) performanceTab.click();
  
  const _optimizeButton = document.getElementById('optimizeWasm');
  const _compressButton = document.getElementById('compressModels');
  const _benchmarkButton = document.getElementById('runBenchmark');
  
  logTest('Optimize WASM button exists', !!optimizeButton);
  logTest('Compress Models button exists', !!compressButton);
  logTest('Run Benchmark button exists', !!benchmarkButton);
  
  return !!(optimizeButton && compressButton && benchmarkButton);
}

// Test 10: Check header buttons
function testHeaderButtons() {
  const _refreshButton = document.getElementById('refreshNeuralData');
  const _exportButton = document.getElementById('exportNeuralData');
  const _closeButton = document.getElementById('closeNeuralPanel');
  
  logTest('Refresh button exists', !!refreshButton);
  logTest('Export button exists', !!exportButton);
  logTest('Close button exists', !!closeButton);
  
  return !!(refreshButton && exportButton && closeButton);
}

// Test 11: Check visual elements
function testVisualElements() {
  const _statusIndicator = document.getElementById('neuralStatusIndicator');
  const _statusText = document.getElementById('neuralStatusText');
  const _performanceMetrics = document.getElementById('performanceMetrics');
  
  logTest('Status indicator exists', !!statusIndicator);
  logTest('Status text exists', !!statusText);
  
  return !!(statusIndicator && statusText);
}

// Test 12: Check WebSocket integration
function testWebSocketIntegration() {
  const _hasNeuralPanel = window.neuralPanel && window.neuralPanel.panel;
  const _hasExtended = window.neuralPanel && window.neuralPanel.extended;
  
  logTest('Neural panel global object exists', hasNeuralPanel);
  logTest('Neural extended functionality exists', hasExtended);
  
  if (hasNeuralPanel) {
    const _panel = window.neuralPanel.panel;
    logTest('Panel is initialized', panel.isInitialized);
    logTest('WebSocket client exists', !!panel.wsClient);
  }
  
  return hasNeuralPanel && hasExtended;
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting Neural Networks Dialog Tests...\n');
  
  // Wait for page to fully load
  if (document.readyState !== 'complete') {
    await new Promise(resolve => window.addEventListener('load', resolve));
  }
  
  // Wait a bit more for dynamic content
  await new Promise(resolve => setTimeout(_resolve, 1000));
  
  // Run tests
  testPanelExists();
  testToggleButton();
  testPanelToggle();
  testTabSwitching();
  testToolCards();
  testTrainingControls();
  testModelControls();
  testPatternControls();
  testPerformanceControls();
  testHeaderButtons();
  testVisualElements();
  testWebSocketIntegration();
  
  // Generate report
  console.log('\n📊 Test Report Summary:');
  console.log(`✅ Passed: ${testReport.passed.length}`);
  console.log(`❌ Failed: ${testReport.failed.length}`);
  console.log(`⚠️ Warnings: ${testReport.warnings.length}`);
  
  if (testReport.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    testReport.failed.forEach(failure => {
      console.log(`  - ${failure.name}: ${failure.message}`);
    });
  }
  
  if (testReport.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    testReport.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }
  
  // Return test report
  return testReport;
}

// Export for use in console
window.testNeuralNetworks = runAllTests;

// Auto-run if script is loaded directly
if (document.readyState === 'complete') {
  runAllTests();
} else {
  window.addEventListener('load', () => {
    setTimeout(_runAllTests, 1000); // Give time for dynamic content to load
  });
}