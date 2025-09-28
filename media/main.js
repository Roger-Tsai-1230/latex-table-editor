// ...existing code...
        // 逆向：將 LaTeX 轉為 HTML 表格
        function latexToHtmlTable(latex) {
            const tabularMatch = latex.match(/\\begin\{tabular\}\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/);
            if (!tabularMatch) { return ''; }
            const align = tabularMatch[1];
            let body = tabularMatch[2].trim();
            body = body.replace(/^%.*\n/gm, '').replace(/\\usepackage\[.*?\]\{xcolor\}\n?/g, '');
            const rows = body.split(/\\\\\s*/).filter(r => r.trim() !== '');
            let html = '<table id="editorTable">';
            // 遞迴解析 cell 內容
            function parseCellContent(str, isTd = true) {
                str = str.trim();
                // cellcolor: 兩層大括號
                if (str.startsWith('\\cellcolor[rgb]')) {
                    let rest = str.slice('\\cellcolor[rgb]'.length);
                    let {content: color, remain: afterColor} = parseBraces(rest);
                    let {content: cellContent, remain} = parseBraces(afterColor);
                    const inner = parseCellContent(cellContent, false);
                    return { html: `<td contenteditable=\"true\" style=\"background-color:${rgbLatexToCss(color)};\">${inner.html}</td>`, remain };
                }
                // colorbox: 兩層大括號
                if (str.startsWith('\\colorbox[rgb]')) {
                    let rest = str.slice('\\colorbox[rgb]'.length);
                    let {content: color, remain: afterColor} = parseBraces(rest);
                    let {content: boxContent, remain} = parseBraces(afterColor);
                    const inner = parseCellContent(boxContent, false);
                    return { html: `<span style=\"background-color:${rgbLatexToCss(color)};\">${inner.html}</span>`, remain };
                }
                // textcolor: 兩層大括號
                if (str.startsWith('\\textcolor[rgb]')) {
                    let rest = str.slice('\\textcolor[rgb]'.length);
                    let {content: color, remain: afterColor} = parseBraces(rest);
                    let {content: textContent, remain} = parseBraces(afterColor);
                    const inner = parseCellContent(textContent, false);
                    return { html: `<span style=\"color:${rgbLatexToCss(color)};\">${inner.html}</span>`, remain };
                }
                // 沒有特殊指令，最外層用 <td>，內層用 span
                if (isTd) {
                    return { html: `<td contenteditable=\"true\">${str.replace(/\}/g, '').replace(/\{/g, '')}</td>`, remain: '' };
                } else {
                    return { html: str.replace(/\}/g, '').replace(/\{/g, ''), remain: '' };
                }
            }
            // 解析 {...}，回傳內容與剩餘字串
            function parseBraces(str) {
                let depth = 0, content = '', i = 0;
                if (str[0] === '{') { i = 1; depth = 1; }
                for (; i < str.length; i++) {
                    if (str[i] === '{') { depth++; }
                    else if (str[i] === '}') { depth--; }
                    if (depth === 0) { break; }
                    content += str[i];
                }
                return { content, remain: str.slice(i+1) };
            }
            function rgbLatexToCss(rgb) {
                const parts = rgb.split(',').map(x => Math.round(parseFloat(x)*255));
                return `rgb(${parts[0]},${parts[1]},${parts[2]})`;
            }
            rows.forEach(row => {
                html += '<tr>';
                const cells = row.split('&');
                cells.forEach(cell => {
                    const parsed = parseCellContent(cell.trim(), true);
                    html += parsed.html;
                });
                html += '</tr>';
            });
            html += '</table>';
            return html;
        }

        // 逆向轉換按鈕
        const reverseBtn = document.createElement('button');
        reverseBtn.textContent = 'LaTeX 轉表格';
        reverseBtn.id = 'latexToTableBtn';
        reverseBtn.onclick = function() {
            // 彈出輸入框
            const dialog = document.createElement('div');
            dialog.className = 'input-dialog';
            dialog.innerHTML = `
                <div class="input-dialog-content">
                    <h3>貼上 LaTeX 表格代碼</h3>
                    <textarea id="latexInput" style="width:100%;height:120px;"></textarea>
                    <div class="input-dialog-buttons">
                        <button class="btn-secondary" onclick="this.closest('.input-dialog').remove()">取消</button>
                        <button class="btn-primary" id="latexToTableConfirmBtn">還原表格</button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);
            document.getElementById('latexToTableConfirmBtn').onclick = function() {
                const latex = document.getElementById('latexInput').value;
                const html = latexToHtmlTable(latex);
                if (html) {
                    const container = document.querySelector('.editor-area');
                    container.innerHTML = html;
                    updateStatus('已從 LaTeX 代碼還原表格');
                } else {
                    updateStatus('LaTeX 解析失敗，請確認格式');
                }
                dialog.remove();
            };
        };
        document.querySelector('.toolbar').appendChild(reverseBtn);
// LaTeX Table Editor - Enhanced Version
(function() {
    const vscode = acquireVsCodeApi();
    
    // 全局状态
    let selectedCells = [];
    let isSelecting = false;
    let startCell = null;
    
    // 工具函数
    function updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }
    
    function clearSelection() {
        selectedCells.forEach(cell => {
            cell.classList.remove('selected-cell');
        });
        selectedCells = [];
        updateStatus('已清除選取');
    }
    
    function addToSelection(cell) {
        if (!selectedCells.includes(cell)) {
            cell.classList.add('selected-cell');
            selectedCells.push(cell);
        }
    }
    
    function removeFromSelection(cell) {
        cell.classList.remove('selected-cell');
        selectedCells = selectedCells.filter(c => c !== cell);
    }
    
    function getCellPosition(cell) {
        const row = cell.parentElement;
        const table = document.getElementById('editorTable');
        const rowIndex = Array.from(table.rows).indexOf(row);
        const colIndex = Array.from(row.cells).indexOf(cell);
        return { row: rowIndex, col: colIndex };
    }
    
    function getMaxCols(table) {
        let maxCols = 0;
        for (let i = 0; i < table.rows.length; i++) {
            let colCount = 0;
            for (let j = 0; j < table.rows[i].cells.length; j++) {
                colCount += table.rows[i].cells[j].colSpan || 1;
            }
            maxCols = Math.max(maxCols, colCount);
        }
        return maxCols;
    }
    
    // 表格操作函数
    function addRow(above = false) {
        const table = document.getElementById('editorTable');
        const selectedCell = selectedCells[0];
        let insertIndex;
        
        if (selectedCell) {
            const { row } = getCellPosition(selectedCell);
            insertIndex = above ? row : row + 1;
        } else {
            insertIndex = above ? 0 : table.rows.length;
        }
        
        const newRow = table.insertRow(insertIndex);
        const maxCols = getMaxCols(table);
        
        for (let i = 0; i < maxCols; i++) {
            const cell = newRow.insertCell();
            cell.contentEditable = 'true';
            cell.innerHTML = '';
        }
        
        updateStatus(`已${above ? '在上方' : '在下方'}插入新行`);
        clearSelection();
    }
    
    function deleteRow() {
        if (selectedCells.length === 0) {
            alert('請先選取要刪除的行中的任一儲存格');
            return;
        }
        
        const table = document.getElementById('editorTable');
        const { row } = getCellPosition(selectedCells[0]);
        
        if (table.rows.length <= 1) {
            alert('無法刪除最後一行');
            return;
        }
        
        table.deleteRow(row);
        updateStatus('已刪除選取的行');
        clearSelection();
    }
    
    function addColumn(left = false) {
        const table = document.getElementById('editorTable');
        const selectedCell = selectedCells[0];
        let insertIndex;
        
        if (selectedCell) {
            const { col } = getCellPosition(selectedCell);
            insertIndex = left ? col : col + 1;
        } else {
            insertIndex = left ? 0 : getMaxCols(table);
        }
        
        for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i];
            const cell = row.insertCell(insertIndex);
            cell.contentEditable = 'true';
            cell.innerHTML = '';
        }
        
        updateStatus(`已${left ? '在左側' : '在右側'}插入新列`);
        clearSelection();
    }
    
    function deleteColumn() {
        if (selectedCells.length === 0) {
            alert('請先選取要刪除的列中的任一儲存格');
            return;
        }
        
        const table = document.getElementById('editorTable');
        const { col } = getCellPosition(selectedCells[0]);
        
        if (getMaxCols(table) <= 1) {
            alert('無法刪除最後一列');
            return;
        }
        
        for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i];
            if (row.cells[col]) {
                row.deleteCell(col);
            }
        }
        
        updateStatus('已刪除選取的列');
        clearSelection();
    }
    
    function mergeCells() {
        if (selectedCells.length < 2) {
            alert('請選取至少兩個儲存格進行合併');
            return;
        }
        
        // 檢查選取的儲存格是否形成矩形區域
        const positions = selectedCells.map(cell => getCellPosition(cell));
        const rows = [...new Set(positions.map(p => p.row))].sort((a, b) => a - b);
        const cols = [...new Set(positions.map(p => p.col))].sort((a, b) => a - b);
        
        if (rows.length !== selectedCells.length && cols.length !== selectedCells.length) {
            alert('請選取形成矩形區域的儲存格');
            return;
        }
        
        // 合併儲存格
        const firstCell = selectedCells[0];
        const content = selectedCells.map(cell => cell.textContent).join(' ');
        firstCell.innerHTML = content;
        firstCell.colSpan = cols.length;
        firstCell.rowSpan = rows.length;
        firstCell.classList.add('merged-cell');
        
        // 刪除其他儲存格
        for (let i = 1; i < selectedCells.length; i++) {
            const cell = selectedCells[i];
            if (cell.parentElement) {
                cell.parentElement.removeChild(cell);
            }
        }
        
        updateStatus(`已合併 ${selectedCells.length} 個儲存格`);
        clearSelection();
    }
    
    function splitCell() {
        if (selectedCells.length !== 1) {
            alert('請選取一個儲存格進行拆分');
            return;
        }
        
        const cell = selectedCells[0];
        if (cell.colSpan <= 1 && cell.rowSpan <= 1) {
            alert('此儲存格無法拆分');
            return;
        }
        
        const content = cell.textContent;
        const rowSpan = cell.rowSpan || 1;
        const colSpan = cell.colSpan || 1;
        
        // 重置儲存格
        cell.colSpan = 1;
        cell.rowSpan = 1;
        cell.classList.remove('merged-cell');
        
        // 插入新的儲存格
        const row = cell.parentElement;
        const table = document.getElementById('editorTable');
        const { row: rowIndex, col: colIndex } = getCellPosition(cell);
        
        // 插入行
        for (let i = 1; i < rowSpan; i++) {
            const newRow = table.insertRow(rowIndex + i);
            for (let j = 0; j < colSpan; j++) {
                const newCell = newRow.insertCell(colIndex + j);
                newCell.contentEditable = 'true';
                newCell.innerHTML = '';
            }
        }
        
        // 插入列
        for (let i = 1; i < colSpan; i++) {
            for (let j = 0; j < rowSpan; j++) {
                const targetRow = table.rows[rowIndex + j];
                const newCell = targetRow.insertCell(colIndex + i);
                newCell.contentEditable = 'true';
                newCell.innerHTML = '';
            }
        }
        
        // 將內容分配到第一個儲存格
        cell.innerHTML = content;
        
        updateStatus(`已拆分儲存格為 ${rowSpan}×${colSpan}`);
        clearSelection();
    }
    
    function deleteCell() {
        if (selectedCells.length !== 1) {
            alert('請選取一個儲存格進行刪除');
            return;
        }
        
        const cell = selectedCells[0];
        const row = cell.parentElement;
        row.removeChild(cell);
        
        updateStatus('已刪除儲存格');
        clearSelection();
    }
    
    function applyAlignment() {
        const alignment = document.getElementById('alignSelect').value;
        
        selectedCells.forEach(cell => {
            cell.style.textAlign = alignment;
        });
        
        updateStatus(`已套用${alignment === 'left' ? '左' : alignment === 'center' ? '居中' : '右'}對齊`);
    }
    
    // 生成LaTeX代碼
    // 将HTML颜色转换为LaTeX颜色命令
    function htmlColorToLatex(htmlColor) {
        // 支援 hex, rgb, rgba, 以及標準色名
    if (!htmlColor) { return '{0.000,0.000,0.000}'; }
        htmlColor = htmlColor.trim();
        // rgb/rgba
        let rgbMatch = htmlColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1], 10) / 255;
            const g = parseInt(rgbMatch[2], 10) / 255;
            const b = parseInt(rgbMatch[3], 10) / 255;
            return `{${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)}}`;
        }
        // hex
        let hexMatch = htmlColor.match(/^#([0-9a-fA-F]{3,8})$/);
        if (hexMatch) {
            let hex = hexMatch[1];
            if (hex.length === 3) {
                hex = hex.split('').map(x => x + x).join('');
            }
            if (hex.length === 6 || hex.length === 8) {
                const r = parseInt(hex.substr(0, 2), 16) / 255;
                const g = parseInt(hex.substr(2, 2), 16) / 255;
                const b = parseInt(hex.substr(4, 2), 16) / 255;
                return `{${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)}}`;
            }
        }
        // 標準色名（只支援常見色，否則預設黑）
        const colorMap = {
            black: '{0.000,0.000,0.000}',
            white: '{1.000,1.000,1.000}',
            red: '{1.000,0.000,0.000}',
            green: '{0.000,1.000,0.000}',
            blue: '{0.000,0.000,1.000}',
            yellow: '{1.000,1.000,0.000}',
            magenta: '{1.000,0.000,1.000}',
            cyan: '{0.000,1.000,1.000}',
            orange: '{1.000,0.647,0.000}',
            pink: '{1.000,0.753,0.796}',
            gray: '{0.502,0.502,0.502}',
            grey: '{0.502,0.502,0.502}'
        };
        const lower = htmlColor.toLowerCase();
    if (colorMap[lower]) { return colorMap[lower]; }
        // 無法解析時預設黑色
        return '{0.000,0.000,0.000}';
    }
    
    // 遞迴處理單元格內容，正確反映 HTML 結果
    function processCellContent(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }
        const tagName = node.tagName ? node.tagName.toLowerCase() : '';
        let inner = '';
        for (let i = 0; i < node.childNodes.length; i++) {
            inner += processCellContent(node.childNodes[i]);
        }
        // span: 先處理顏色，順序：\colorbox -> \textcolor
        if (tagName === 'span') {
            let latexText = inner;
            // 先包 textcolor 再包 colorbox，這樣外層 colorbox 會正確包住白字
            if (node.style.color && node.style.color !== '' && node.style.color !== 'inherit') {
                const color = htmlColorToLatex(node.style.color);
                latexText = `\\textcolor[rgb]${color}{${latexText}}`;
            }
            if (node.style.backgroundColor && node.style.backgroundColor !== '' && node.style.backgroundColor !== 'inherit') {
                const bgColor = htmlColorToLatex(node.style.backgroundColor);
                latexText = `\\colorbox[rgb]${bgColor}{${latexText}}`;
            }
            return latexText;
        }
        // b, strong: 粗體
        if (tagName === 'b' || tagName === 'strong') {
            return `\\textbf{${inner}}`;
        }
        // i, em: 斜體
        if (tagName === 'i' || tagName === 'em') {
            return `\\textit{${inner}}`;
        }
        // u: 底線
        if (tagName === 'u') {
            return `\\underline{${inner}}`;
        }
        // a: 超連結
        if (tagName === 'a' && node.href) {
            return `\\href{${node.href}}{${inner}}`;
        }
        // 其他標籤直接遞迴內容
        return inner;
    }
    
    function generateLatex() {
        const table = document.getElementById('editorTable');
        const maxCols = getMaxCols(table);
        // 檢查是否需要顏色包
        let needsColorPackage = false;
        let needsColortblPackage = false;
        // 掃描所有單元格檢查顏色
        for (let i = 0; i < table.rows.length; i++) {
            for (let j = 0; j < table.rows[i].cells.length; j++) {
                const cell = table.rows[i].cells[j];
                if (cell.style.backgroundColor) {
                    needsColortblPackage = true;
                }
                const spans = cell.querySelectorAll('span');
                spans.forEach(span => {
                    if (span.style.color || span.style.backgroundColor) {
                        needsColorPackage = true;
                    }
                });
            }
        }
        let latex = '';
        if (needsColorPackage || needsColortblPackage) {
            latex += '% 需要放在文档最前面\n';
            latex += '\\usepackage[table]{xcolor}\n';
        }
        latex += '\\begin{tabular}{' + 'c'.repeat(maxCols) + '}\n';
        for (let i = 0; i < table.rows.length; i++) {
            let row = [];
            let colIdx = 0;
            for (let j = 0; j < table.rows[i].cells.length; j++) {
                const cell = table.rows[i].cells[j];
                let colspan = cell.colSpan || 1;
                function htmlToLatex(node) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        return node.textContent;
                    }
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        return '';
                    }
                    let content = '';
                    for (let k = 0; k < node.childNodes.length; k++) {
                        content += htmlToLatex(node.childNodes[k]);
                    }
                    const tag = node.tagName ? node.tagName.toLowerCase() : '';
                    if (tag === 'span') {
                        let latex = content;
                        if (node.style.color && node.style.color !== '' && node.style.color !== 'inherit') {
                            latex = `\\textcolor[rgb]${htmlColorToLatex(node.style.color)}{${latex}}`;
                        }
                        if (node.style.backgroundColor && node.style.backgroundColor !== '' && node.style.backgroundColor !== 'inherit') {
                            latex = `\\colorbox[rgb]${htmlColorToLatex(node.style.backgroundColor)}{${latex}}`;
                        }
                        return latex;
                    }
                    return content;
                }
                let cellContent = htmlToLatex(cell);
                let finalContent = cellContent;
                if (cell.style.backgroundColor && cell.style.backgroundColor !== '' && cell.style.backgroundColor !== 'inherit') {
                    finalContent = `\\cellcolor[rgb]${htmlColorToLatex(cell.style.backgroundColor)}{${cellContent}}`;
                }
                if (colspan > 1) {
                    const multicolContent = `\\multicolumn{${colspan}}{c}{${finalContent}}`;
                    row.push(multicolContent);
                    colIdx += colspan;
                } else {
                    row.push(finalContent);
                    colIdx++;
                }
            }
            while (colIdx < maxCols) {
                row.push('');
                colIdx++;
            }
            latex += row.join(' & ') + ' \\\\\n';
        }
        latex += '\\end{tabular}';
        document.getElementById('latexOutput').textContent = latex;
        updateStatus('已產生 LaTeX 代碼');
        return latex;
    }
    
    
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            updateStatus('已複製到剪貼簿');
        }).catch(() => {
            // 降級方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            updateStatus('已複製到剪貼簿');
        });
    }
    
    // 自定义输入对话框
    function showInputDialog(title, fields, callback) {
        const dialog = document.createElement('div');
        dialog.className = 'input-dialog';
        dialog.innerHTML = `
            <div class="input-dialog-content">
                <h3>${title}</h3>
                ${fields.map(field => {
                    if (field.type === 'select') {
                        return `
                            <label for="${field.id}">${field.label}</label>
                            <select id="${field.id}">
                                ${field.options.map(option => 
                                    `<option value="${option.value}" ${option.value === field.value ? 'selected' : ''}>${option.text}</option>`
                                ).join('')}
                            </select>
                        `;
                    } else {
                        return `
                            <label for="${field.id}">${field.label}</label>
                            <input type="${field.type || 'text'}" id="${field.id}" value="${field.value || ''}" placeholder="${field.placeholder || ''}">
                        `;
                    }
                }).join('')}
                <div class="input-dialog-buttons">
                    <button class="btn-secondary" onclick="this.closest('.input-dialog').remove()">取消</button>
                    <button class="btn-primary" onclick="handleDialogSubmit(this)">確定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 处理对话框提交
        window.handleDialogSubmit = function(button) {
            const dialog = button.closest('.input-dialog');
            const values = {};
            fields.forEach(field => {
                const element = dialog.querySelector(`#${field.id}`);
                values[field.id] = element.value;
            });
            dialog.remove();
            callback(values);
        };
        
        // 点击背景关闭对话框
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
        
        // 聚焦到第一个输入框
        const firstInput = dialog.querySelector('input');
        if (firstInput) {
            firstInput.focus();
        }
    }
    
    // 插入功能
    function insertImage() {
        console.log('insertImage function called');
        
        if (selectedCells.length === 0) {
            alert('請先選取要插入圖片的儲存格');
            return;
        }
        
        showInputDialog('插入圖片', [
            {
                id: 'imagePath',
                label: '圖片路徑（相對於LaTeX文檔）',
                value: 'images/example.png',
                placeholder: '例如：images/example.png'
            },
            {
                id: 'caption',
                label: '圖片標題（可選）',
                value: '',
                placeholder: '例如：示例圖片'
            },
            {
                id: 'width',
                label: '圖片寬度（可選）',
                value: '0.5\\textwidth',
                placeholder: '例如：0.5\\textwidth'
            }
        ], function(values) {
            if (!values.imagePath) { return; }
            
            let latexCode = `\\includegraphics[width=${values.width}]{${values.imagePath}}`;
            if (values.caption) {
                latexCode = `\\begin{figure}[h]\n\\centering\n${latexCode}\n\\caption{${values.caption}}\n\\end{figure}`;
            }
            
            selectedCells.forEach(cell => {
                // 插入游標處
                if (document.activeElement === cell && typeof cell.selectionStart === 'number') {
                    // 若是 input/textarea 類型
                    const start = cell.selectionStart;
                    const end = cell.selectionEnd;
                    cell.value = cell.value.slice(0, start) + latexCode + cell.value.slice(end);
                } else {
                    // contenteditable
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0 && cell.contains(sel.anchorNode)) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(document.createTextNode(latexCode));
                    } else {
                        // 若無游標則直接加在最後
                        cell.innerHTML += latexCode;
                    }
                }
            });
            
            updateStatus('已插入圖片');
            clearSelection();
        });
    }
    
    function insertEquation() {
        console.log('insertEquation function called');
        
        if (selectedCells.length === 0) {
            alert('請先選取要插入方程式的儲存格');
            return;
        }
        
        showInputDialog('插入方程式', [
            {
                id: 'equationType',
                label: '方程式類型',
                type: 'select',
                value: 'inline',
                options: [
                    { value: 'inline', text: '行內方程式 ($...$)' },
                    { value: 'display', text: '獨立方程式 (\\[...\\])' },
                    { value: 'numbered', text: '編號方程式 (\\begin{equation})' }
                ]
            },
            {
                id: 'equation',
                label: '方程式內容',
                value: 'x^2 + y^2 = z^2',
                placeholder: '例如：x^2 + y^2 = z^2'
            }
        ], function(values) {
            if (!values.equation) { return; }
            
            let latexCode = '';
            switch(values.equationType) {
                case 'inline':
                    latexCode = `$${values.equation}$`;
                    break;
                case 'display':
                    latexCode = `\\[${values.equation}\\]`;
                    break;
                case 'numbered':
                    latexCode = `\\begin{equation}\n${values.equation}\n\\end{equation}`;
                    break;
            }
            
            selectedCells.forEach(cell => {
                if (document.activeElement === cell && typeof cell.selectionStart === 'number') {
                    const start = cell.selectionStart;
                    const end = cell.selectionEnd;
                    cell.value = cell.value.slice(0, start) + latexCode + cell.value.slice(end);
                } else {
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0 && cell.contains(sel.anchorNode)) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(document.createTextNode(latexCode));
                    } else {
                        cell.innerHTML += latexCode;
                    }
                }
            });
            
            updateStatus('已插入方程式');
            clearSelection();
        });
    }
    
    function insertLink() {
        console.log('insertLink function called');
        
        if (selectedCells.length === 0) {
            alert('請先選取要插入超連結的儲存格');
            return;
        }
        
        showInputDialog('插入超連結', [
            {
                id: 'url',
                label: '網址',
                value: 'https://example.com',
                placeholder: '例如：https://example.com'
            },
            {
                id: 'linkText',
                label: '連結文字',
                value: '點擊這裡',
                placeholder: '例如：點擊這裡'
            }
        ], function(values) {
            if (!values.url) { return; }
            
            const latexCode = `\\href{${values.url}}{${values.linkText || '點擊這裡'}}`;
            
            selectedCells.forEach(cell => {
                if (document.activeElement === cell && typeof cell.selectionStart === 'number') {
                    const start = cell.selectionStart;
                    const end = cell.selectionEnd;
                    cell.value = cell.value.slice(0, start) + latexCode + cell.value.slice(end);
                } else {
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0 && cell.contains(sel.anchorNode)) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(document.createTextNode(latexCode));
                    } else {
                        cell.innerHTML += latexCode;
                    }
                }
            });
            
            updateStatus('已插入超連結');
            clearSelection();
        });
    }
    
    // 应用颜色到选中的文字
    function applyColorToSelectedText(type = 'text') {
        const selection = window.getSelection();
    if (selection.rangeCount === 0) { return; }
        
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().trim();
        
        if (selectedText.length === 0) {
            alert('請先選取要設定顏色的文字');
            return;
        }
        
        // 创建颜色选择器
        const dialog = document.createElement('div');
        dialog.className = 'color-picker-dialog';
        
        const colorPalette = [
            '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
            '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#C0C0C0', '#808080',
            '#FFA500', '#FFC0CB', '#FFE4B5', '#F0E68C', '#98FB98', '#AFEEEE', '#DDA0DD', '#F5DEB3',
            '#FF6347', '#40E0D0', '#EE82EE', '#90EE90', '#87CEEB', '#D8BFD8', '#F0F8FF', '#FAEBD7'
        ];
        
        const title = type === 'textBackground' ? '選擇文字背景顏色' : '選擇文字顏色';
        dialog.innerHTML = `
            <div class="color-picker-content">
                <h3>${title}</h3>
                <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">選中的文字：<strong>"${selectedText}"</strong></p>
                <div class="color-palette">
                    ${colorPalette.map(color => 
                        `<div class="color-option" style="background-color: ${color}" data-color="${color}"></div>`
                    ).join('')}
                </div>
                <div class="custom-color-section">
                    <label>自訂顏色：</label>
                    <input type="color" class="custom-color-input" id="customColor" value="#000000">
                </div>
                <div class="color-picker-buttons">
                    <button class="btn-secondary" onclick="this.closest('.color-picker-dialog').remove()">取消</button>
                    <button class="btn-primary" onclick="applyColorToTextSelection(this)">套用</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        let selectedColor = '#000000';
        
        // 预设颜色选择
        const colorOptions = dialog.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', function() {
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                selectedColor = this.dataset.color;
            });
        });
        
        // 自定义颜色选择
        const customColorInput = dialog.querySelector('#customColor');
        customColorInput.addEventListener('change', function() {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            selectedColor = this.value;
        });
        
        // 应用颜色到选中的文字
        window.applyColorToTextSelection = function(button) {
            try {
                // 创建span元素包装选中的文字
                const span = document.createElement('span');
                
                if (type === 'textBackground') {
                    span.style.backgroundColor = selectedColor;
                    span.style.padding = '2px 4px';
                    span.style.borderRadius = '2px';
                } else {
                    span.style.color = selectedColor;
                }
                
                // 删除选中的内容并插入带颜色的span
                range.deleteContents();
                range.insertNode(span);
                
                // 将选中的文字移动到span中
                const textNode = document.createTextNode(selectedText);
                span.appendChild(textNode);
                
                // 清除选择
                selection.removeAllRanges();
                
                dialog.remove();
                const message = type === 'textBackground' ? '已套用文字背景顏色到選中的文字' : '已套用文字顏色到選中的文字';
                updateStatus(message);
            } catch (error) {
                console.error('应用文字颜色时出错:', error);
                alert('套用顏色時發生錯誤');
            }
        };
        
        // 点击背景关闭对话框
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }
    
    // 颜色选择功能
    function showColorPicker(type) {
        // 检查是否有选中的文字
        const selection = window.getSelection();
        const hasTextSelection = selection.toString().trim().length > 0;
        
        if ((type === 'text' || type === 'textBackground') && hasTextSelection) {
            // 如果有文字被选中，直接应用颜色到选中的文字
            applyColorToSelectedText(type);
            return;
        }
        
        if (selectedCells.length === 0) {
            alert('請先選取要設定顏色的儲存格');
            return;
        }
        
        const dialog = document.createElement('div');
        dialog.className = 'color-picker-dialog';
        
        const colorPalette = [
            '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
            '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#C0C0C0', '#808080',
            '#FFA500', '#FFC0CB', '#FFE4B5', '#F0E68C', '#98FB98', '#AFEEEE', '#DDA0DD', '#F5DEB3',
            '#FF6347', '#40E0D0', '#EE82EE', '#90EE90', '#87CEEB', '#D8BFD8', '#F0F8FF', '#FAEBD7'
        ];
        
        dialog.innerHTML = `
            <div class="color-picker-content">
                <h3>選擇${type === 'text' ? '文字' : type === 'background' ? '背景' : '框線'}顏色</h3>
                <div class="color-palette">
                    ${colorPalette.map(color => 
                        `<div class="color-option" style="background-color: ${color}" data-color="${color}"></div>`
                    ).join('')}
                </div>
                <div class="custom-color-section">
                    <label>自訂顏色：</label>
                    <input type="color" class="custom-color-input" id="customColor" value="#000000">
                </div>
                <div class="color-picker-buttons">
                    <button class="btn-secondary" onclick="this.closest('.color-picker-dialog').remove()">取消</button>
                    <button class="btn-primary" onclick="applyColor('${type}', this)">套用</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        let selectedColor = '#000000';
        
        // 预设颜色选择
        const colorOptions = dialog.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.addEventListener('click', function() {
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                selectedColor = this.dataset.color;
            });
        });
        
        // 自定义颜色选择
        const customColorInput = dialog.querySelector('#customColor');
        customColorInput.addEventListener('change', function() {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            selectedColor = this.value;
        });
        
        // 应用颜色
        window.applyColor = function(colorType, button) {
            const cells = selectedCells;
            
            cells.forEach(cell => {
                switch(colorType) {
                    case 'text':
                        cell.style.color = selectedColor;
                        break;
                    case 'textBackground':
                        // 为单元格内的所有文字添加背景颜色
                        const textNodes = getTextNodes(cell);
                        textNodes.forEach(textNode => {
                            if (textNode.textContent.trim()) {
                                const span = document.createElement('span');
                                span.style.backgroundColor = selectedColor;
                                span.style.padding = '2px 4px';
                                span.style.borderRadius = '2px';
                                textNode.parentNode.insertBefore(span, textNode);
                                span.appendChild(textNode);
                            }
                        });
                        break;
                    case 'background':
                        cell.style.backgroundColor = selectedColor;
                        break;
                    case 'border':
                        cell.style.borderColor = selectedColor;
                        break;
                }
            });
            
            dialog.remove();
            const typeNames = {
                'text': '文字',
                'textBackground': '文字背景',
                'background': '儲存格背景',
                'border': '框線'
            };
            updateStatus(`已套用${typeNames[colorType]}顏色到 ${cells.length} 個儲存格`);
        };
        
        // 点击背景关闭对话框
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }
    
    // 获取元素内的所有文本节点
    function getTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim()) {
                textNodes.push(node);
            }
        }
        
        return textNodes;
    }
    
    // 事件監聽器
    document.addEventListener('DOMContentLoaded', function() {
        const table = document.getElementById('editorTable');
        
        // 儲存格點擊事件
        table.addEventListener('click', function(e) {
            if (e.target.tagName === 'TD') {
                if (e.ctrlKey || e.metaKey) {
                    // 多選
                    if (selectedCells.includes(e.target)) {
                        removeFromSelection(e.target);
                    } else {
                        addToSelection(e.target);
                    }
                } else {
                    // 單選
                    clearSelection();
                    addToSelection(e.target);
                }
                updateStatus(`已選取 ${selectedCells.length} 個儲存格`);
            }
        });
        
        // 拖拽選取
        table.addEventListener('mousedown', function(e) {
            if (e.target.tagName === 'TD') {
                isSelecting = true;
                startCell = e.target;
                clearSelection();
                addToSelection(e.target);
            }
        });
        
        table.addEventListener('mouseover', function(e) {
            if (isSelecting && e.target.tagName === 'TD') {
                clearSelection();
                // 簡單的矩形選取實現
                const startPos = getCellPosition(startCell);
                const endPos = getCellPosition(e.target);
                
                const minRow = Math.min(startPos.row, endPos.row);
                const maxRow = Math.max(startPos.row, endPos.row);
                const minCol = Math.min(startPos.col, endPos.col);
                const maxCol = Math.max(startPos.col, endPos.col);
                
                for (let row = minRow; row <= maxRow; row++) {
                    for (let col = minCol; col <= maxCol; col++) {
                        const cell = table.rows[row]?.cells[col];
                        if (cell) {
                            addToSelection(cell);
                        }
                    }
                }
            }
        });
        
        document.addEventListener('mouseup', function() {
            isSelecting = false;
            startCell = null;
        });
        
        // 鍵盤快捷鍵
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'a':
                        e.preventDefault();
                        clearSelection();
                        const allCells = table.querySelectorAll('td');
                        allCells.forEach(cell => addToSelection(cell));
                        updateStatus('已全選所有儲存格');
                        break;
                    case 'c':
                        if (selectedCells.length > 0) {
                            e.preventDefault();
                            const content = selectedCells.map(cell => cell.textContent).join('\t');
                            copyToClipboard(content);
                        }
                        break;
                }
            }
        });
        
        // 對齊選擇器
        document.getElementById('alignSelect').addEventListener('change', applyAlignment);
        
        // 按鈕事件
        document.getElementById('addRowAboveBtn').onclick = () => addRow(true);
        document.getElementById('addRowBelowBtn').onclick = () => addRow(false);
        document.getElementById('deleteRowBtn').onclick = deleteRow;
        document.getElementById('addColLeftBtn').onclick = () => addColumn(true);
        document.getElementById('addColRightBtn').onclick = () => addColumn(false);
        document.getElementById('deleteColBtn').onclick = deleteColumn;
        document.getElementById('mergeBtn').onclick = mergeCells;
        document.getElementById('splitBtn').onclick = splitCell;
        document.getElementById('deleteCellBtn').onclick = deleteCell;
        // 插入功能按钮
        const insertImageBtn = document.getElementById('insertImageBtn');
        const insertEquationBtn = document.getElementById('insertEquationBtn');
        const insertLinkBtn = document.getElementById('insertLinkBtn');
        
        console.log('Button elements found:', {
            insertImageBtn: !!insertImageBtn,
            insertEquationBtn: !!insertEquationBtn,
            insertLinkBtn: !!insertLinkBtn
        });
        
        if (insertImageBtn) {
            insertImageBtn.onclick = function() {
                console.log('Image button clicked!');
                insertImage();
            };
            console.log('insertImageBtn onclick set');
        }
        if (insertEquationBtn) {
            insertEquationBtn.onclick = function() {
                console.log('Equation button clicked!');
                insertEquation();
            };
            console.log('insertEquationBtn onclick set');
        }
        if (insertLinkBtn) {
            insertLinkBtn.onclick = function() {
                console.log('Link button clicked!');
                insertLink();
            };
            console.log('insertLinkBtn onclick set');
        }
        
        // 颜色按钮
        const textColorBtn = document.getElementById('textColorBtn');
        const textBgColorBtn = document.getElementById('textBgColorBtn');
        const bgColorBtn = document.getElementById('bgColorBtn');
        const borderColorBtn = document.getElementById('borderColorBtn');
        
        if (textColorBtn) {
            textColorBtn.onclick = () => showColorPicker('text');
        }
        if (textBgColorBtn) {
            textBgColorBtn.onclick = () => showColorPicker('textBackground');
        }
        if (bgColorBtn) {
            bgColorBtn.onclick = () => showColorPicker('background');
        }
        if (borderColorBtn) {
            borderColorBtn.onclick = () => showColorPicker('border');
        }
        
        document.getElementById('genLatexBtn').onclick = generateLatex;
        document.getElementById('insertBtn').onclick = function() {
            const latex = generateLatex();
            vscode.postMessage({ command: 'insertLatex', latex });
        };
        document.getElementById('insertBtn2').onclick = function() {
            const latex = generateLatex();
            vscode.postMessage({ command: 'insertLatex', latex });
        };
        document.getElementById('copyLatexBtn').onclick = function() {
            const latex = document.getElementById('latexOutput').textContent;
            copyToClipboard(latex);
        };
        
        updateStatus('表格編輯器已就緒');
    });
})();