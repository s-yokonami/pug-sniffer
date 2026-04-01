import * as vscode from 'vscode';

/** SCSSファイル内容のキャッシュ */
const scssCache = new Map<string, string>();

/**
 * カーソル位置からPugクラス名を抽出する
 * ショートハンド記法（.class-name）のみ対応
 */
function extractClassName(
	document: vscode.TextDocument,
	position: vscode.Position
): string | undefined {
	const range = document.getWordRangeAtPosition(position, /[\w-]+/);
	if (!range) {
		return undefined;
	}

	// ワードの直前が `.` であればクラス名
	const charBefore = range.start.character > 0
		? document.getText(new vscode.Range(range.start.translate(0, -1), range.start))
		: '';

	if (charBefore !== '.') {
		return undefined;
	}

	return document.getText(range);
}

/**
 * BEMクラス名を分解する
 * 最初の `__` で block と element に分割
 */
function parseBemClass(className: string): { block: string; element?: string } {
	const idx = className.indexOf('__');
	if (idx === -1) {
		return { block: className };
	}
	return {
		block: className.substring(0, idx),
		element: className.substring(idx + 2),
	};
}

/**
 * SCSSファイルの内容を取得する（キャッシュ付き）
 */
async function getScssContent(uri: vscode.Uri): Promise<string> {
	const key = uri.toString();
	const cached = scssCache.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const bytes = await vscode.workspace.fs.readFile(uri);
	const text = Buffer.from(bytes).toString('utf-8');
	scssCache.set(key, text);
	return text;
}

/**
 * SCSSファイル群からクラス定義の位置を検索する
 */
async function findScssDefinition(
	className: string,
	scssFiles: vscode.Uri[]
): Promise<vscode.Location[]> {
	const { block, element } = parseBemClass(className);
	const locations: vscode.Location[] = [];

	for (const uri of scssFiles) {
		const text = await getScssContent(uri);
		const lines = text.split('\n');

		if (element) {
			// BEMエレメント: まず .block__element のフラット定義を探す
			const flatPattern = new RegExp(
				`\\.${escapeRegExp(block)}__${escapeRegExp(element)}\\s*[{,\\s]`
			);
			for (let i = 0; i < lines.length; i++) {
				if (flatPattern.test(lines[i])) {
					locations.push(new vscode.Location(
						uri,
						new vscode.Position(i, lines[i].indexOf(`.${block}__${element}`))
					));
				}
			}

			// 次に &__element のネスト定義を探す（同ファイル内に .block がある場合）
			const blockPattern = new RegExp(`\\.${escapeRegExp(block)}\\s*[{,\\s]`);
			const hasBlock = lines.some(line => blockPattern.test(line));

			if (hasBlock) {
				const nestPattern = new RegExp(
					`&__${escapeRegExp(element)}\\s*[{,\\s]`
				);
				for (let i = 0; i < lines.length; i++) {
					if (nestPattern.test(lines[i])) {
						const col = lines[i].indexOf(`&__${element}`);
						locations.push(new vscode.Location(
							uri,
							new vscode.Position(i, col >= 0 ? col : 0)
						));
					}
				}
			}
		} else {
			// ブロック直接マッチ: .block-name を探す
			const pattern = new RegExp(
				`\\.${escapeRegExp(block)}\\s*[{,\\s]`
			);
			for (let i = 0; i < lines.length; i++) {
				if (pattern.test(lines[i])) {
					const col = lines[i].indexOf(`.${block}`);
					locations.push(new vscode.Location(
						uri,
						new vscode.Position(i, col >= 0 ? col : 0)
					));
				}
			}
		}
	}

	return locations;
}

/** 正規表現の特殊文字をエスケープ */
function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class PugClassDefinitionProvider implements vscode.DefinitionProvider {
	async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken
	): Promise<vscode.Location[] | undefined> {
		const className = extractClassName(document, position);
		if (!className) {
			return undefined;
		}

		const config = vscode.workspace.getConfiguration('pugSniffer');
		const glob = config.get<string>('scssGlob', 'src/assets/**/*.scss');

		const scssFiles = await vscode.workspace.findFiles(glob);
		if (scssFiles.length === 0) {
			return undefined;
		}

		const locations = await findScssDefinition(className, scssFiles);
		return locations.length > 0 ? locations : undefined;
	}
}

export function activate(context: vscode.ExtensionContext) {
	const provider = new PugClassDefinitionProvider();

	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider(
			{ language: 'jade' },
			provider
		),
		vscode.languages.registerDefinitionProvider(
			{ language: 'pug' },
			provider
		)
	);

	// SCSSファイルの変更を監視してキャッシュを無効化
	const watcher = vscode.workspace.createFileSystemWatcher('**/*.scss');
	const invalidate = (uri: vscode.Uri) => scssCache.delete(uri.toString());
	watcher.onDidChange(invalidate);
	watcher.onDidCreate(invalidate);
	watcher.onDidDelete(invalidate);
	context.subscriptions.push(watcher);
}

export function deactivate() {
	scssCache.clear();
}
