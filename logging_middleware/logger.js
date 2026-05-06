import axios from 'axios';

const VALID_STACKS = ['backend', 'frontend'];
const VALID_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];

const BACKEND_PACKAGES = ['cache','controller','cron_job','db','domain','handler','repository','route','service'];
const FRONTEND_PACKAGES = ['api','component','hook','page','state','style'];

const SHARED_PACKAGES = ['auth','config','middleware','utils'];

const ALL_PACKAGES = {
  backend: [...BACKEND_PACKAGES, ...SHARED_PACKAGES],
  frontend: [...FRONTEND_PACKAGES, ...SHARED_PACKAGES]
};

// Log API endpoint
const LOG_API_URL = 'http://20.207.122.201/evaluation-service/logs';

function validateParams(stack, level, packageName, message) {
  if (!stack || typeof stack !== 'string') {
    return { isValid: false, error: 'Stack is required and must be a string' };
  }

  if (!VALID_STACKS.includes(stack.toLowerCase())) {
    return { 
      isValid: false, 
      error: `Stack must be one of: ${VALID_STACKS.join(', ')}` 
    };
  }

  if (!level || typeof level !== 'string') {
    return { isValid: false, error: 'Level is required and must be a string' };
  }

  if (!VALID_LEVELS.includes(level.toLowerCase())) {
    return { 
      isValid: false, 
      error: `Level must be one of the follwing : ${VALID_LEVELS.join(', ')}` 
    };
  }

  if (!packageName || typeof packageName !== 'string') {
    return { isValid: false, error: 'Package is required and must be a string' };
  }

  const stackLower = stack.toLowerCase();
  const validPackages = ALL_PACKAGES[stackLower];

  if (!validPackages.includes(packageName.toLowerCase())) {
    return { 
      isValid: false, 
      error: `Package must be one of: ${validPackages.join(', ')} for stack '${stackLower}'` 
    };
  }

  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Message is required and must be a string' };
  }

  return { isValid: true };
}

export async function Log(stack, level, packageName, message, authToken) {
  try {
    // Validate parameters
    const validation = validateParams(stack, level, packageName, message);
    if (!validation.isValid) {
      throw new Error(`Validation Error: ${validation.error}`);
    }

    if (!authToken || typeof authToken !== 'string') {
      throw new Error('Validation Error: authToken is required and must be a string');
    }
    
    // Normalize parameters to lowercase
    const normalizedStack = stack.toLowerCase();
    const normalizedLevel = level.toLowerCase();
    const normalizedPackage = packageName.toLowerCase();
    const normalizedAuthToken = authToken.trim();

    // Prepare request headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${normalizedAuthToken}`
    };

    // Prepare request body
    const requestBody = {
      stack: normalizedStack,
      level: normalizedLevel,
      package: normalizedPackage,
      message: message
    };

    // Make API call
    const response = await axios.post(LOG_API_URL, requestBody, { headers });

    // Return successful response
    return {
      success: true,
      logId: response.data.logId,
      message: response.data.message,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    if (error.response) {
      throw new Error(
        `API Error [${error.response.status}]: ${error.response.data?.message || error.message}`
      );
    } else if (error.request) {
      // Request made but no response
      throw new Error(`Network Error: No response from logging server - ${error.message}`);
    } else if (error.message.startsWith('Validation Error:')) {
        throw error;
    } else {
        throw new Error(`Logging Error: ${error.message}`);
    }
  }
}

