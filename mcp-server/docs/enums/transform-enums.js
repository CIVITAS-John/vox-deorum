import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse enum from .h file content
function parseEnum(content, fileName) {
  const enumRegex = /enum\s+(?:CLOSED_ENUM\s+)?(\w+Types)\s*\{([^}]+)\}/gs;
  const enums = [];
  
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    const enumName = match[1];
    const enumBody = match[2];
    
    // Parse enum values
    const values = {};
    const lines = enumBody.split('\n');
    let currentValue = -1;
    
    for (const line of lines) {
      // Skip lines that start with // (comment-only lines)
      if (line.trim().startsWith('//')) continue;
      
      // Remove comments and trim - handle inline comments with //
      const cleanLine = line
        .replace(/\r/g, '')          // Remove carriage returns
        .replace(/\/\/.*$/, '')      // Remove // comments
        .replace(/\/\*.*?\*\//g, '') // Remove /* */ comments
        .trim();
      
      if (!cleanLine || cleanLine === '') continue;
      
      // Skip meta values
      if (cleanLine.includes('ENUM_META_VALUE')) continue;
      if (cleanLine.match(/^NUM_\w+_TYPES/)) continue;
      
      // Parse enum entry - handle optional comma at the end
      const entryMatch = cleanLine.match(/^(\w+)(?:\s*=\s*(-?\d+))?\s*,?\s*$/);
      if (entryMatch) {
        const name = entryMatch[1];
        
        // Skip NUM_*_TYPES entries
        if (name.match(/^NUM_\w+_TYPES$/)) continue;
        
        if (entryMatch[2] !== undefined) {
          // Explicit value provided
          currentValue = parseInt(entryMatch[2]);
        } else {
          // No explicit value
          if (Object.keys(values).length === 0) {
            // First entry - check if it starts with NO_ for -1
            if (name.startsWith('NO_')) {
              currentValue = -1;
            } else {
              currentValue = 0;
            }
          } else {
            // Increment from previous value
            currentValue++;
          }
        }
        
        values[currentValue] = name;
      }
    }
    
    if (Object.keys(values).length > 0) {
      enums.push({ name: enumName, values });
    }
  }
  
  return enums;
}

// Generate TypeScript content for an enum
function generateTypeScript(enumData) {
  const { name, values } = enumData;
  
  let ts = `/**\n * Auto-generated from ${name} enum\n */\n`;
  ts += `export const ${name}: Record<number, string> = {\n`;
  
  // Convert string to PascalCase
  const toPascalCase = (str) => {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  };

  // Find common prefix among values
  const nonNegativeValues = Object.entries(values)
    .filter(([key]) => parseInt(key) != -1)
    .map(([, value]) => value);
  
  let commonPrefix = '';
  if (nonNegativeValues.length > 0) {
    // Find common prefix by checking each character position
    const minLength = Math.min(...nonNegativeValues.map(v => v.length));
    for (let i = 0; i < minLength; i++) {
      const char = nonNegativeValues[0][i];
      if (nonNegativeValues.every(v => v[i] === char)) {
        commonPrefix += char;
      } else {
        break;
      }
    }
    // Only keep prefix up to last underscore to avoid partial word removal
    const lastUnderscore = commonPrefix.lastIndexOf('_');
    if (lastUnderscore > 0) {
      commonPrefix = commonPrefix.substring(0, lastUnderscore + 1);
    } else {
      commonPrefix = '';
    }
  }

  const entries = Object.entries(values)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([key, value]) => {
      // Quote the key if it's negative to make valid TypeScript
      const keyStr = parseInt(key) < 0 ? `'${key}'` : key;
      
      // Special case for -1: always "None"
      if (parseInt(key) === -1) {
        return `  ${keyStr}: 'None'`;
      }
      
      // Remove common prefix and convert to PascalCase
      const withoutPrefix = commonPrefix && value.startsWith(commonPrefix) 
        ? value.substring(commonPrefix.length) 
        : value;
      const pascalValue = toPascalCase(withoutPrefix);
      return `  ${keyStr}: '${pascalValue}'`;
    });
  
  ts += entries.join(',\n');
  ts += '\n};\n';
  
  return ts;
}

// Main transformation function
async function transformEnums() {
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const inputDir = path.join(projectRoot, 'mcp-server', 'docs', 'enums');
  const cvEnumsPath = path.join(projectRoot, 'civ5-dll', 'CvGameCoreDLLUtil', 'include', 'CvEnums.h');
  const outputDir = path.join(projectRoot, 'mcp-server', 'src', 'database', 'enums');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const enumFiles = [];
  const allEnums = [];
  
  // Process .h files from docs/enums
  if (fs.existsSync(inputDir)) {
    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.h'));
    
    for (const file of files) {
      const filePath = path.join(inputDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const enums = parseEnum(content, file);
      
      for (const enumData of enums) {
        const tsContent = generateTypeScript(enumData);
        const outputFile = `${enumData.name}.ts`;
        const outputPath = path.join(outputDir, outputFile);
        
        fs.writeFileSync(outputPath, tsContent);
        enumFiles.push({ name: enumData.name, file: outputFile });
        allEnums.push(enumData.name);
        
        console.log(`Generated ${outputFile} from ${file}`);
      }
    }
  }
  
  // Process CvEnums.h
  if (fs.existsSync(cvEnumsPath)) {
    console.log('\nProcessing CvEnums.h...');
    const content = fs.readFileSync(cvEnumsPath, 'utf-8');
    const enums = parseEnum(content, 'CvEnums.h');
    
    for (const enumData of enums) {
      // Skip if already processed
      if (allEnums.includes(enumData.name)) {
        console.log(`Skipping ${enumData.name} (already exists)`);
        continue;
      }
      
      const tsContent = generateTypeScript(enumData);
      const outputFile = `${enumData.name}.ts`;
      const outputPath = path.join(outputDir, outputFile);
      
      fs.writeFileSync(outputPath, tsContent);
      enumFiles.push({ name: enumData.name, file: outputFile });
      allEnums.push(enumData.name);
      
      console.log(`Generated ${outputFile} from CvEnums.h`);
    }
  }
  
  // Generate summary
  console.log('\n=== Summary ===');
  console.log(`Total enums processed: ${enumFiles.length}`);
  console.log(`Output directory: ${outputDir}`);
  console.log('\nEnum files generated:');
  enumFiles.forEach(({ name }) => console.log(`  - ${name}`));
}

// Run the transformation
transformEnums().catch(console.error);