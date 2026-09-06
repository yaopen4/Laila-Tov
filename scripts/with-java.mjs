#!/usr/bin/env node
/**
 * Run a command with a Java 21+ runtime on PATH.
 *
 * The Firestore emulator requires Java 21 or newer. A machine can easily have an older
 * JDK earlier on PATH (or JAVA_HOME pointing at one) for unrelated reasons, and then
 * `firebase emulators:start` fails with a message about Java versions that has nothing
 * to do with this project.
 *
 * Rather than change the developer's global environment, this finds a suitable JDK and
 * sets JAVA_HOME/PATH for the child process only. If the default `java` is already new
 * enough, nothing is changed.
 *
 * Usage:  node scripts/with-java.mjs <command> [args...]
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIN_MAJOR = 21;

/** Major version of the `java` at a given home, or null if unusable. */
function javaMajor(javaHome = null) {
  const bin = javaHome ? join(javaHome, 'bin', 'java') : 'java';
  const result = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;

  // `java -version` writes to stderr, in the form: openjdk version "21.0.12" ...
  const match = /version "(\d+)/.exec(`${result.stderr}${result.stdout}`);
  return match ? Number(match[1]) : null;
}

/** Directories that commonly hold JDK installations, per platform. */
function candidateRoots() {
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
    return [
      join(programFiles, 'Microsoft'),
      join(programFiles, 'Java'),
      join(programFiles, 'Eclipse Adoptium'),
      join(programFiles, 'Amazon Corretto'),
      join(programFiles, 'Zulu'),
    ];
  }
  if (process.platform === 'darwin') return ['/Library/Java/JavaVirtualMachines'];
  return ['/usr/lib/jvm'];
}

function findJavaHome() {
  for (const root of candidateRoots()) {
    if (!existsSync(root)) continue;

    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      let home = join(root, entry.name);
      // macOS nests the real home inside the bundle.
      if (process.platform === 'darwin' && existsSync(join(home, 'Contents', 'Home'))) {
        home = join(home, 'Contents', 'Home');
      }
      const major = javaMajor(home);
      if (major !== null && major >= MIN_MAJOR) return home;
    }
  }
  return null;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node scripts/with-java.mjs <command> [args...]');
  process.exit(1);
}

const env = { ...process.env };
const currentMajor = javaMajor();

if (currentMajor === null || currentMajor < MIN_MAJOR) {
  const javaHome = findJavaHome();

  if (!javaHome) {
    console.error(
      `\nThe Firestore emulator needs Java ${MIN_MAJOR}+, but ` +
        (currentMajor === null ? 'no `java` was found on PATH.' : `Java ${currentMajor} is on PATH.`) +
        '\n\nInstall a JDK, then re-run:\n' +
        '  Windows:  winget install Microsoft.OpenJDK.21\n' +
        '  macOS:    brew install openjdk@21\n' +
        '  Linux:    sudo apt install openjdk-21-jdk\n'
    );
    process.exit(1);
  }

  env.JAVA_HOME = javaHome;

  // Windows env vars are case-insensitive but a JS object is not: process.env copies
  // the key as 'Path', so assigning env.PATH would add a *second* entry and the child
  // would inherit an ambiguous PATH (dropping npm's node_modules/.bin). Update the
  // key that is actually there.
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const separator = process.platform === 'win32' ? ';' : ':';
  env[pathKey] = `${join(javaHome, 'bin')}${separator}${env[pathKey] ?? ''}`;

  console.log(`[with-java] Using JDK at ${javaHome} for this command.`);
}

// A single command string rather than an args array: with shell:true, Node warns that
// array args are concatenated unescaped. Quote anything containing whitespace.
const commandLine = [command, ...args]
  .map((arg) => (/\s/.test(arg) && !/^".*"$/.test(arg) ? JSON.stringify(arg) : arg))
  .join(' ');

const child = spawn(commandLine, { env, stdio: 'inherit', shell: true });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
