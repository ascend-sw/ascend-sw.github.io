const fs = require('fs/promises');
const { spawn } = require('child_process');

const fsS = require('fs');
const path = require('path');

// 1. Function to remove a directory
async function removeDirectory(directoryPath) {
    try {
        console.log(`Attempting to remove directory: ${directoryPath}`);
        await fs.rm(directoryPath, { recursive: true, force: true });
        console.log(`Successfully removed directory: ${directoryPath}`);
    } catch (err) {
        console.error(`Error removing directory: ${err.message}`);
        // Rethrow the error to stop the execution flow
        throw err;
    }
}

// 2. Function to execute the sitespeed.io command
function executeSitespeedCommand(command) {
    return new Promise((resolve, reject) => {
        console.log(`\nExecuting command: ${command}`);

        const parts = command.split(' ');
        const child = spawn(parts[0], parts.slice(1), { stdio: 'inherit' });

        child.on('close', (code) => {
            console.log(`sitespeed.io process exited with code ${code}`);
            if (code !== 0) {
                // Reject the promise if the command fails
                reject(new Error('sitespeed.io command failed.'));
            } else {
                // Resolve the promise on success
                resolve();
            }
        });

        child.on('error', (err) => {
            console.log(err);
            // Reject if an error occurs while spawning the process
            reject(err);
        });
    });
}

// 3. Function to move a directory
async function moveDirectory(sourcePath, destinationPath) {
    try {
        console.log(`\nMoving folder from ${sourcePath} to ${destinationPath}`);

        // Ensure the destination directory exists
        const destinationDir = destinationPath.substring(0, destinationPath.lastIndexOf('/'));
        await fs.mkdir(destinationDir, { recursive: true });

        await fs.rename(sourcePath, destinationPath);
        console.log('Folder moved successfully!');
    } catch (err) {
        console.error(`Error moving folder: ${err.message}`);
        // Rethrow the error
        throw err;
    }
}

// 4. Remove unnecessary files
async function removeUnnecessaryFiles(dir) {
    try {
        if (!fsS.existsSync(dir)) return;

        fsS.readdirSync(dir).forEach((file) => {
            const fullPath = path.join(dir, file);
            const stat = fsS.statSync(fullPath);

            if (stat.isDirectory()) {
                // Recurse into subdir
                removeUnnecessaryFiles(fullPath);
            } else {
                if (file.endsWith('.har.gz')) {
                    try {
                        fsS.unlinkSync(fullPath);
                        console.log(`🗑️ Deleted HAR: ${fullPath}`);
                    } catch (err) {
                        console.error(`❌ Could not delete ${fullPath}:`, err.message);
                    }
                } else if (file.endsWith('.json')) {
                    if (file === 'browsertime.pageSummary.json' || file === 'browsertime.summary-total.json') {
                        console.log(`✅ Keeping: ${fullPath}`);
                    } else {
                        try {
                            fsS.unlinkSync(fullPath);
                            console.log(`🗑️ Deleted JSON: ${fullPath}`);
                        } catch (err) {
                            console.error(`❌ Could not delete ${fullPath}:`, err.message);
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error(`Error moving folder: ${err.message}`);
        // Rethrow the error
        throw err;
    }
}

// Main execution flow
async function runWorkflow() {
    const releaseName = `${process.argv[2]}`;

    const sitespeedCommand = `sitespeed.io scripts/baristina_urls.txt --config scripts/config.json --outputFolder ${releaseName}`;
    const sourceFolder = `${releaseName}`;
    const destinationFolder = `baristina/${releaseName}`;

    if (process.argv.length < 3) {
        console.log('Please provide a release name as an argument. Example: node scripts/baristina-e2e-speed.js release-29');
        process.exit(1);
    }

    try {
        // Step 1: Remove the old directory
        await removeDirectory(releaseName);

        // Step 2: Execute the sitespeed.io command
        await executeSitespeedCommand(sitespeedCommand);

        // Step 3: Move the newly created directory
        await removeDirectory(`baristina/${releaseName}`);
        await moveDirectory(sourceFolder, destinationFolder);

        // Step 4: remove unnecessary files
        await removeUnnecessaryFiles(`baristina/${releaseName}`);

        console.log('\nWorkflow completed successfully!');

    } catch (err) {
        console.error(`\nWorkflow failed: ${err.message}`);
        // Exit with an error code
        process.exit(1);
    }
}

runWorkflow();