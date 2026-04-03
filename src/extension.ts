import * as vscode from 'vscode';

/** SCSSファイル内容のキャッシュ */
const scssCache = new Map<string, string>();

/** Pugファイル内容のキャッシュ */
const pugCache = new Map<string, string>();

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
 * カーソル位置からPug mixin呼び出し名を抽出する
 * +mixinName 記法に対応
 */
function extractMixinName(
	document: vscode.TextDocument,
	position: vscode.Position
): string | undefined {
	const range = document.getWordRangeAtPosition(position, /[\w-]+/);
	if (!range) {
		return undefined;
	}

	// ワードの直前が `+` であれば mixin 呼び出し
	const charBefore = range.start.character > 0
		? document.getText(new vscode.Range(range.start.translate(0, -1), range.start))
		: '';

	if (charBefore !== '+') {
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

/**
 * Pugファイルの内容を取得する（キャッシュ付き）
 */
async function getPugContent(uri: vscode.Uri): Promise<string> {
	const key = uri.toString();
	const cached = pugCache.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const bytes = await vscode.workspace.fs.readFile(uri);
	const text = Buffer.from(bytes).toString('utf-8');
	pugCache.set(key, text);
	return text;
}

/**
 * Pugファイル群からmixin定義の位置を検索する
 */
async function findMixinDefinition(
	mixinName: string,
	pugFiles: vscode.Uri[]
): Promise<vscode.Location[]> {
	const locations: vscode.Location[] = [];
	const pattern = new RegExp(
		`^(\\s*)mixin\\s+${escapeRegExp(mixinName)}\\s*(\\(|$)`
	);

	for (const uri of pugFiles) {
		const text = await getPugContent(uri);
		const lines = text.split('\n');

		for (let i = 0; i < lines.length; i++) {
			if (pattern.test(lines[i])) {
				const col = lines[i].indexOf(`mixin ${mixinName}`);
				locations.push(new vscode.Location(
					uri,
					new vscode.Position(i, col >= 0 ? col : 0)
				));
			}
		}
	}

	return locations;
}

/**
 * カーソル位置が extends/include のパス部分であればパスと範囲を返す
 */
function extractPugFilePath(
	document: vscode.TextDocument,
	position: vscode.Position
): { filePath: string; range: vscode.Range } | undefined {
	const line = document.lineAt(position.line).text;
	const match = line.match(/^\s*(?:extends|include)\s+(\S+)/);
	if (!match) {
		return undefined;
	}
	const pathStart = line.indexOf(match[1]);
	const pathEnd = pathStart + match[1].length;
	if (position.character < pathStart || position.character > pathEnd) {
		return undefined;
	}
	return {
		filePath: match[1],
		range: new vscode.Range(
			new vscode.Position(position.line, pathStart),
			new vscode.Position(position.line, pathEnd)
		),
	};
}

/**
 * Pugの extends/include パスを解決してURIを返す
 * 絶対パス（/で始まる）は src/ を基準、相対パスは現在のファイル基準
 */
async function resolvePugFilePath(
	filePath: string,
	currentDocumentUri: vscode.Uri
): Promise<vscode.Uri | undefined> {
	const candidates: vscode.Uri[] = [];

	if (filePath.startsWith('/')) {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentDocumentUri);
		if (!workspaceFolder) {
			return undefined;
		}
		candidates.push(vscode.Uri.joinPath(workspaceFolder.uri, 'src', filePath));
		if (!/\.(pug|jade)$/.test(filePath)) {
			candidates.push(vscode.Uri.joinPath(workspaceFolder.uri, 'src', filePath + '.pug'));
		}
	} else {
		const currentDir = vscode.Uri.joinPath(currentDocumentUri, '..');
		candidates.push(vscode.Uri.joinPath(currentDir, filePath));
		if (!/\.(pug|jade)$/.test(filePath)) {
			candidates.push(vscode.Uri.joinPath(currentDir, filePath + '.pug'));
		}
	}

	for (const uri of candidates) {
		try {
			await vscode.workspace.fs.stat(uri);
			return uri;
		} catch {
			// ファイルが存在しない
		}
	}
	return undefined;
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
	): Promise<vscode.Location[] | vscode.DefinitionLink[] | undefined> {
		const config = vscode.workspace.getConfiguration('pugSniffer');

		// extends/include のパス → ファイルを開く
		const pugFilePath = extractPugFilePath(document, position);
		if (pugFilePath) {
			const uri = await resolvePugFilePath(pugFilePath.filePath, document.uri);
			if (uri) {
				return [{
					originSelectionRange: pugFilePath.range,
					targetUri: uri,
					targetRange: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
				}];
			}
		}

		// クラス名 → SCSS定義
		const className = extractClassName(document, position);
		if (className) {
			const glob = config.get<string>('scssGlob', 'src/assets/**/*.scss');
			const scssFiles = await vscode.workspace.findFiles(glob);
			if (scssFiles.length > 0) {
				const locations = await findScssDefinition(className, scssFiles);
				if (locations.length > 0) {
					return locations;
				}
			}
		}

		// mixin呼び出し → mixin定義
		const mixinName = extractMixinName(document, position);
		if (mixinName) {
			const pugGlob = config.get<string>('pugGlob', 'src/**/*.pug');
			const pugFiles = await vscode.workspace.findFiles(pugGlob);
			if (pugFiles.length > 0) {
				const locations = await findMixinDefinition(mixinName, pugFiles);
				if (locations.length > 0) {
					return locations;
				}
			}
		}

		return undefined;
	}
}

export function activate(context: vscode.ExtensionContext) {
	const provider = new PugClassDefinitionProvider();

	// ハイフンを含むクラス名をひとつの単語として扱う（cmd+クリック時のアンダーライン範囲修正）
	const wordPattern = /[\w-]+/;
	vscode.languages.setLanguageConfiguration('pug', { wordPattern });
	vscode.languages.setLanguageConfiguration('jade', { wordPattern });

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
	const scssWatcher = vscode.workspace.createFileSystemWatcher('**/*.scss');
	const invalidateScss = (uri: vscode.Uri) => scssCache.delete(uri.toString());
	scssWatcher.onDidChange(invalidateScss);
	scssWatcher.onDidCreate(invalidateScss);
	scssWatcher.onDidDelete(invalidateScss);
	context.subscriptions.push(scssWatcher);

	// Pugファイルの変更を監視してキャッシュを無効化
	const pugWatcher = vscode.workspace.createFileSystemWatcher('**/*.pug');
	const invalidatePug = (uri: vscode.Uri) => pugCache.delete(uri.toString());
	pugWatcher.onDidChange(invalidatePug);
	pugWatcher.onDidCreate(invalidatePug);
	pugWatcher.onDidDelete(invalidatePug);
	context.subscriptions.push(pugWatcher);
}

export function deactivate() {
	scssCache.clear();
	pugCache.clear();
}
