// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "latex-table-editor" is now active!');

	// Hello World command (保留)
	const disposable = vscode.commands.registerCommand('latex-table-editor.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from latex-table-editor!');
	});
	context.subscriptions.push(disposable);

	// 新增：打開 LaTeX 表格編輯器 Webview
	const openEditorDisposable = vscode.commands.registerCommand('latex-table-editor.openEditor', () => {
		const panel = vscode.window.createWebviewPanel(
			'latexTableEditor',
			'LaTeX Table Editor',
			vscode.ViewColumn.One,
			{
				enableScripts: true
			}
		);
		panel.webview.html = getWebviewContent(panel, context.extensionUri);

		// 接收 Webview 傳來的 LaTeX，插入到當前檔案
		panel.webview.onDidReceiveMessage(async (message) => {
			if (message.command === 'insertLatex' && message.latex) {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showErrorMessage('找不到可用的文字編輯器，請先開啟一個檔案再插入表格。');
					return;
				}
				if (!editor.selection || !editor.selection.active) {
					vscode.window.showErrorMessage('找不到游標位置，請將游標放在要插入的位置。');
					return;
				}
				try {
					const success = await editor.edit(editBuilder => {
						editBuilder.insert(editor.selection.active, message.latex);
					});
					if (success) {
						vscode.window.showInformationMessage('LaTeX 表格已插入到檔案');
					} else {
						vscode.window.showErrorMessage('插入失敗，請檢查檔案是否可編輯。');
					}
				} catch (err) {
					vscode.window.showErrorMessage('插入過程發生錯誤: ' + String(err));
				}
			}
			// 逆向：取得選取的 LaTeX 代碼
			if (message.command === 'getSelectedLatex') {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showErrorMessage('請先開啟一個檔案並選取 LaTeX 代碼');
					return;
				}
				const selection = editor.selection;
				const latex = editor.document.getText(selection);
				panel.webview.postMessage({ command: 'setTableFromLatex', latex });
			}
		});
	});
	context.subscriptions.push(openEditorDisposable);
}

function getWebviewContent(panel: vscode.WebviewPanel, extensionUri: vscode.Uri): string {
	const scriptUri = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(
			extensionUri,
			'media',
			'main.js'
		)
	);
	return `
	<!DOCTYPE html>
	<html lang="zh-TW">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>LaTeX 表格編輯器</title>
		   <style>
			   * { box-sizing: border-box; }
			   body {
				   font-family: 'Segoe UI', 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif;
				   margin: 0;
				   padding: 0;
				   background: #181c20;
			   }
			   .container {
				   max-width: 1100px;
				   margin: 24px auto;
				   background: #23272e;
				   border-radius: 12px;
				   box-shadow: 0 4px 24px rgba(0,0,0,0.32);
				   overflow: hidden;
			   }
			   .toolbar {
				   background: linear-gradient(90deg, #23272e 0%, #1a202c 100%);
				   border-bottom: 1.5px solid #2d3748;
				   padding: 14px 20px;
				   display: flex;
				   flex-wrap: wrap;
				   gap: 12px;
				   align-items: center;
			   }
			   .toolbar-group {
				   display: flex;
				   gap: 6px;
				   align-items: center;
				   padding-right: 18px;
				   border-right: 1.5px solid #2d3748;
			   }
			   .toolbar-group:last-child {
				   border-right: none;
			   }
			   .toolbar button {
				   background: linear-gradient(90deg, #2563eb 0%, #0078d4 100%);
				   color: #fff;
				   border: none;
				   padding: 7px 16px;
				   border-radius: 6px;
				   cursor: pointer;
				   font-size: 15px;
				   font-weight: 500;
				   box-shadow: 0 1px 2px rgba(0,0,0,0.04);
				   transition: background 0.2s, box-shadow 0.2s;
			   }
			   .toolbar button:hover {
				   background: linear-gradient(90deg, #1e40af 0%, #2563eb 100%);
				   box-shadow: 0 2px 8px rgba(79,140,255,0.10);
			   }
			   .toolbar button:disabled {
				   background: #374151;
				   cursor: not-allowed;
			   }
			   .toolbar select {
				   background: #23272e;
				   color: #e0e8f0;
				   border: 1.5px solid #374151;
				   padding: 5px 10px;
				   border-radius: 5px;
				   font-size: 15px;
			   }
			   .editor-area {
				   padding: 28px 24px 24px 24px;
				   overflow: auto;
				   max-height: 60vh;
				   background: #23272e;
			   }
			   #editorTable {
				   border-collapse: collapse;
				   margin: 0 auto;
				   background: #fff;
				   box-shadow: 0 2px 8px rgba(0,0,0,0.18);
			   }
			   #editorTable td, #editorTable th {
				   border: 1.5px solid #374151;
				   padding: 10px 18px;
				   min-width: 70px;
				   min-height: 36px;
				   text-align: left;
				   vertical-align: top;
				   position: relative;
				   /* color: #23272e;  // 移除預設文字色，讓自訂色可顯示 */
				   font-size: 15px;
				   background: #fff;
				   transition: background 0.2s;
			   }
			   #editorTable td[contenteditable="true"] {
				   background: #fff;
				   outline: none;
			   }
			   #editorTable td[contenteditable="true"]:focus {
				   background: #1e293b;
				   box-shadow: 0 0 0 2px #4f8cff inset;
			   }
			   .selected-cell {
				   background: transparent !important;
				   outline: 2.5px solid #2563eb !important;
				   /* 可選：讓 outline 更明顯 */
				   z-index: 1;
			   }
			   .merged-cell {
				   background: #23272e;
			   }
			   .latex-output {
				   margin-top: 28px;
				   padding: 20px;
				   background: #23272e;
				   border: 1.5px solid #374151;
				   border-radius: 8px;
				   color: #e0e8f0;
			   }
			   .latex-output h3 {
				   margin: 0 0 14px 0;
				   font-size: 16px;
				   color: #60a5fa;
			   }
			   .latex-code {
				   font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
				   background: #181c20;
				   color: #e0e8f0;
				   padding: 14px;
				   border-radius: 6px;
				   white-space: pre-wrap;
				   word-break: break-all;
				   font-size: 14px;
				   line-height: 1.5;
			   }
			   .action-buttons {
				   display: flex;
				   gap: 10px;
				   margin-top: 16px;
			   }
			   .action-buttons button {
				   background: linear-gradient(90deg, #22d3ee 0%, #2563eb 100%);
				   color: #fff;
				   border: none;
				   padding: 9px 20px;
				   border-radius: 6px;
				   cursor: pointer;
				   font-size: 15px;
				   font-weight: 500;
				   transition: background 0.2s;
			   }
			   .action-buttons button:hover {
				   background: linear-gradient(90deg, #2563eb 0%, #22d3ee 100%);
			   }
			   .status-bar {
				   background: #181c20;
				   border-top: 1.5px solid #374151;
				   padding: 10px 20px;
				   font-size: 13px;
				   color: #a3a3a3;
			   }
			   /* 對話框、顏色選擇器等樣式同上，略... */
		   </style>
	</head>
	<body>
		<div class="container">
			<div class="toolbar">
				<div class="toolbar-group">
					<button id="addRowAboveBtn">↑ 插入行</button>
					<button id="addRowBelowBtn">↓ 插入行</button>
					<button id="deleteRowBtn">刪除行</button>
				</div>
				<div class="toolbar-group">
					<button id="addColLeftBtn">← 插入列</button>
					<button id="addColRightBtn">→ 插入列</button>
					<button id="deleteColBtn">刪除列</button>
				</div>
				<div class="toolbar-group">
					<button id="mergeBtn">合併儲存格</button>
					<button id="splitBtn">拆分儲存格</button>
					<button id="deleteCellBtn">刪除儲存格</button>
				</div>
				<div class="toolbar-group">
					<label>對齊：</label>
					<select id="alignSelect">
						<option value="left">左對齊</option>
						<option value="center">居中</option>
						<option value="right">右對齊</option>
					</select>
				</div>
				<div class="toolbar-group">
					<button id="textColorBtn" title="文字顏色">🎨 文字</button>
					<button id="textBgColorBtn" title="文字背景顏色">🖍️ 文字背景</button>
					<button id="bgColorBtn" title="儲存格背景顏色">🖌️ 儲存格背景</button>
					<button id="borderColorBtn" title="框線顏色">📏 框線</button>
				</div>
				<div class="toolbar-group">
					<button id="insertImageBtn" title="插入圖片">🖼️ 圖片</button>
					<button id="insertEquationBtn" title="插入方程式">📐 方程式</button>
					<button id="insertLinkBtn" title="插入超連結">🔗 連結</button>
				</div>
				<div class="toolbar-group">
					<button id="genLatexBtn">產生 LaTeX</button>
					<button id="insertBtn">插入到檔案</button>
				</div>
			</div>
			
			<div class="editor-area">
				<table id="editorTable">
					<tr><td contenteditable="true"></td><td contenteditable="true"></td></tr>
					<tr><td contenteditable="true"></td><td contenteditable="true"></td></tr>
				</table>
			</div>
			
			<div class="latex-output">
				<h3>LaTeX 代碼</h3>
				<div class="latex-code" id="latexOutput">請點擊「產生 LaTeX」按鈕</div>
				<div class="action-buttons">
					<button id="copyLatexBtn">複製代碼</button>
					<button id="insertBtn2">插入到檔案</button>
				</div>
			</div>
			
			<div class="status-bar">
				<span id="statusText">準備就緒</span>
			</div>
		</div>
		<script src="${scriptUri}"></script>
	</body>
	</html>
	`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
