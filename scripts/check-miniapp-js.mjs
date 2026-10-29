// ミニアプリ・ウィジェットの JavaScript(controller/*.js)の、書き間違いの検査(`npm run check:js`)。
// TypeScript の型の検査(tsconfig.miniapps.json)を、**ミニアプリ・ウィジェットごとの組で、別々に**行う。
// これらは、`<script>` で読み込む普通のスクリプトなので、同じページで続けて読み込む(= トップレベルの名前を共有する)ファイル
// (同じ `controller` フォルダの中)は、まとめて 1 つの組として検査する。別のミニアプリのファイルとは、トップレベルの名前(`$`・`cur` など)が別物なので、
// 混ぜて検査すると、同じ名前が衝突して、偽の指摘が連鎖する。
// エラーにするのは、書き間違いを示す指摘だけ。DOM の型の細かい指摘(`HTMLElement` に `value` が無い、など)は、ゆるい JavaScript ではほとんどが誤検出なので、無視する。
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import ts from "typescript";

/** 無視する指摘の番号(ゆるい JavaScript では、ほとんどが誤検出)。 */
const IGNORED = new Set([
  2339, // プロパティが無い(`querySelector` の結果は `HTMLElement` なので、`value` などが無いと言われる)
  2322, // 型が合わない(`el.style.width = 3` など。ブラウザは受け付ける)
  2345, // 引数の型が合わない
  2531, // null かもしれない
  2532, // undefined かもしれない
  2531,
  18047,
  18048,
  2551, // ベンダー接頭辞(`webkitAudioContext`)・`select` など、型に無いが実在するもの
  7006,
  7053,
]);

const configPath = fileURLToPath(new URL("../tsconfig.miniapps.json", import.meta.url));
const read = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath));

/** ミニアプリ・ウィジェットのフォルダ(`controller` の 1 つ上)ごとの、ファイルの組。 */
const groups = new Map();
for (const file of parsed.fileNames) {
  const key = dirname(dirname(file));
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(file);
}

const problems = [];
let ignored = 0;
for (const files of groups.values()) {
  const program = ts.createProgram(files, parsed.options);
  for (const file of files) {
    for (const d of ts.getPreEmitDiagnostics(program, program.getSourceFile(file))) {
      if (!d.file) continue;
      if (IGNORED.has(d.code)) {
        ignored++;
        continue;
      }
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
      const text = ts.flattenDiagnosticMessageText(d.messageText, " ");
      problems.push(`${d.file.fileName}(${line + 1},${character + 1}): TS${d.code} ${text}`);
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\nミニアプリ・ウィジェットの JavaScript: ${problems.length} 件の書き間違いの疑い`);
  process.exit(1);
}
console.log(
  `ミニアプリ・ウィジェットの JavaScript: OK(${parsed.fileNames.length} ファイルを、${groups.size} 組に分けて検査。無視した指摘 ${ignored} 件)`,
);
