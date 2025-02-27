<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>テニスダブルス 組み合わせ表ジェネレーター</title>
  <!-- SheetJS for Excel出力 -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  <!-- html2canvas for 画像出力 -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #f7f9fc;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 700px;
      margin: auto;
      background: #fff;
      padding: 20px 30px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    h1 {
      text-align: center;
      color: #007bff;
      margin-bottom: 20px;
    }
    .input-group {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 10px;
      align-items: center;
    }
    .input-group label {
      flex: 0 0 150px;
      font-weight: bold;
    }
    .input-group input, .input-group select {
      flex: 1;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    .note {
      font-size: 0.9em;
      color: #555;
      margin-left: 150px;
      margin-bottom: 10px;
    }
    button {
      width: 100%;
      background: #007bff;
      color: #fff;
      border: none;
      padding: 12px;
      font-size: 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 15px;
    }
    button:hover {
      background: #0056b3;
    }
    #scheduleOutput {
      margin-top: 20px;
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: center;
    }
    th {
      background: #007bff;
      color: white;
    }
    .round-title {
      background: #f0f8ff;
      font-weight: bold;
    }
    .download-btns {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .download-btns button {
      flex: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>テニスダブルス 組み合わせ表ジェネレーター</h1>
    <div class="input-group">
      <label for="totalPlayers">プレイヤー数:</label>
      <input type="number" id="totalPlayers" value="8" min="4" required>
    </div>
    <div class="input-group">
      <label for="courts">コート数 (1～10):</label>
      <select id="courts">
        <!-- 1～10面 -->
        <option value="1">1面</option>
        <option value="2" selected>2面</option>
        <option value="3">3面</option>
        <option value="4">4面</option>
        <option value="5">5面</option>
        <option value="6">6面</option>
        <option value="7">7面</option>
        <option value="8">8面</option>
        <option value="9">9面</option>
        <option value="10">10面</option>
      </select>
    </div>
    <div class="input-group">
      <label for="rounds">ラウンド数:</label>
      <input type="number" id="rounds" value="5" min="1" required>
    </div>
    <div class="note" id="maxRoundNote"></div>
    <button id="generateBtn">組み合わせ表を生成</button>
    <div class="download-btns" id="downloadBtns" style="display:none;">
      <button id="downloadExcelBtn">Excelでダウンロード</button>
      <button id="downloadImgBtn">画像でダウンロード</button>
    </div>
    <div id="scheduleOutput"></div>
  </div>

  <script>
    // ユーティリティ：Fisher-Yatesで配列をシャッフル
    function shuffleArray(array) {
      let arr = array.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    // 4人グループから、3通りの2チーム分割のうち、これまで未使用のペアを返す
    function findValidSplit(group, usedPairs) {
      const splits = [
        [[group[0], group[1]], [group[2], group[3]]],
        [[group[0], group[2]], [group[1], group[3]]],
        [[group[0], group[3]], [group[1], group[2]]]
      ];
      const shuffledSplits = shuffleArray(splits);
      for (let split of shuffledSplits) {
        let team1 = split[0].slice().sort((a, b) => a - b);
        let team2 = split[1].slice().sort((a, b) => a - b);
        let key1 = team1.join(",");
        let key2 = team2.join(",");
        if (!usedPairs.has(key1) && !usedPairs.has(key2)) {
          return { team1, team2, keys: [key1, key2] };
        }
      }
      return null;
    }

    // 最大試合数（各ラウンドで使用できる試合数＝使用コート数と4人組の最大数の小さい方）
    function getMatchesCount(totalPlayers, courts) {
      return Math.min(courts, Math.floor(totalPlayers / 4));
    }

    // 理論上の最大ラウンド数を計算（各ラウンドは2×試合数のチームを使う）
    function computeMaxRounds(totalPlayers, courts) {
      const m = getMatchesCount(totalPlayers, courts);
      if (m === 0) return 0;
      const totalUniqueTeams = totalPlayers * (totalPlayers - 1) / 2;
      return Math.floor(totalUniqueTeams / (2 * m));
    }

    // 各ラウンドのスケジュールを生成（同じチームが重複しないように）
    function generateSchedule(totalPlayers, courts, roundsDesired) {
      let schedule = [];
      let usedPairs = new Set();
      let players = [];
      for (let i = 1; i <= totalPlayers; i++) {
        players.push(i);
      }
      const m = getMatchesCount(totalPlayers, courts);
      const maxAttemptsPerRound = 200;
      
      for (let r = 0; r < roundsDesired; r++) {
        let roundMatches = [];
        let attempt = 0;
        let roundSuccess = false;
        let roundResting = [];
        while (attempt < maxAttemptsPerRound && !roundSuccess) {
          attempt++;
          let shuffled = shuffleArray(players);
          // 先頭4*m人を試合に割り当て、残りは休憩
          if (shuffled.length < 4 * m) continue; // safety check
          let activePlayers = shuffled.slice(0, 4 * m);
          let restingPlayers = shuffled.slice(4 * m);
          let tempMatches = [];
          let validRound = true;
          // 各グループ（試合）ごとに組み合わせ生成
          for (let i = 0; i < m; i++) {
            let group = activePlayers.slice(i * 4, i * 4 + 4);
            let split = findValidSplit(group, usedPairs);
            if (split) {
              tempMatches.push({ court: i + 1, team1: split.team1, team2: split.team2 });
            } else {
              validRound = false;
              break;
            }
          }
          if (validRound) {
            roundMatches = tempMatches;
            roundResting = restingPlayers;
            roundSuccess = true;
            // 使用済みペアの更新
            tempMatches.forEach(match => {
              let key1 = match.team1.slice().sort((a,b)=>a-b).join(",");
              let key2 = match.team2.slice().sort((a,b)=>a-b).join(",");
              usedPairs.add(key1);
              usedPairs.add(key2);
            });
          }
        }
        if (!roundSuccess) {
          alert("ラウンド " + (r + 1) + " の組み合わせ生成に失敗しました。\n指定条件でこれ以上の組み合わせが作れません。");
          break;
        }
        schedule.push({ round: r + 1, matches: roundMatches, resting: roundResting });
      }
      return schedule;
    }

    // HTMLテーブルとしてスケジュールを描画
    function renderSchedule(schedule) {
      const container = document.getElementById("scheduleOutput");
      container.innerHTML = "";
      schedule.forEach(round => {
        const roundDiv = document.createElement("div");
        roundDiv.style.marginBottom = "20px";
        const title = document.createElement("h3");
        title.textContent = "【ラウンド " + round.round + "】";
        roundDiv.appendChild(title);

        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["コート", "チーム1", "チーム2"].forEach(text => {
          const th = document.createElement("th");
          th.textContent = text;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        round.matches.forEach(match => {
          const tr = document.createElement("tr");
          const tdCourt = document.createElement("td");
          tdCourt.textContent = match.court;
          const tdTeam1 = document.createElement("td");
          tdTeam1.textContent = match.team1.join(" & ");
          const tdTeam2 = document.createElement("td");
          tdTeam2.textContent = match.team2.join(" & ");
          tr.appendChild(tdCourt);
          tr.appendChild(tdTeam1);
          tr.appendChild(tdTeam2);
          tbody.appendChild(tr);
        });
        // 休憩プレイヤーがいる場合
        if (round.resting.length > 0) {
          const tr = document.createElement("tr");
          const tdRest = document.createElement("td");
          tdRest.colSpan = 3;
          tdRest.style.textAlign = "left";
          tdRest.textContent = "【休憩】 " + round.resting.join(", ");
          tr.appendChild(tdRest);
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        roundDiv.appendChild(table);
        container.appendChild(roundDiv);
      });
    }

    // Excel用データ作成＆出力
    function downloadExcel(schedule) {
      let data = [["ラウンド", "コート", "チーム1", "チーム2", "休憩"]];
      schedule.forEach(round => {
        round.matches.forEach(match => {
          data.push([round.round, match.court, match.team1.join(" & "), match.team2.join(" & "), ""]);
        });
        if(round.resting.length > 0) {
          data.push([round.round, "", "", "", round.resting.join(", ")]);
        }
      });
      let ws = XLSX.utils.aoa_to_sheet(data);
      let wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "組み合わせ表");
      XLSX.writeFile(wb, "tennis_doubles_schedule.xlsx");
    }

    // 画面表示部（スケジュールOutput領域）を画像（PNG）としてダウンロード（html2canvas利用）
    function downloadImage() {
      const container = document.getElementById("scheduleOutput");
      html2canvas(container).then(canvas => {
        canvas.toBlob(function(blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "tennis_doubles_schedule.png";
          a.click();
        });
      });
    }

    // 入力値変更時、理論上の最大ラウンド数を自動更新
    function updateMaxRounds() {
      const totalPlayers = parseInt(document.getElementById("totalPlayers").value);
      const courts = parseInt(document.getElementById("courts").value);
      const maxRounds = computeMaxRounds(totalPlayers, courts);
      const roundsInput = document.getElementById("rounds");
      roundsInput.max = maxRounds;
      if (!roundsInput.value || parseInt(roundsInput.value) > maxRounds) {
        roundsInput.value = maxRounds;
      }
      document.getElementById("maxRoundNote").textContent =
        "（組める最大ラウンド数: " + maxRounds + "）";
    }

    // イベントリスナー設定
    document.getElementById("totalPlayers").addEventListener("change", updateMaxRounds);
    document.getElementById("courts").addEventListener("change", updateMaxRounds);
    window.addEventListener("load", updateMaxRounds);

    document.getElementById("generateBtn").addEventListener("click", function() {
      const totalPlayers = parseInt(document.getElementById("totalPlayers").value);
      const courts = parseInt(document.getElementById("courts").value);
      const roundsDesired = parseInt(document.getElementById("rounds").value);
      if (isNaN(totalPlayers) || totalPlayers < 4) {
        alert("プレイヤー数は4以上で入力してください。");
        return;
      }
      const maxRounds = computeMaxRounds(totalPlayers, courts);
      if (roundsDesired > maxRounds) {
        alert("指定されたラウンド数は最大 " + maxRounds + " を超えています。");
        return;
      }
      const schedule = generateSchedule(totalPlayers, courts, roundsDesired);
      if(schedule.length === 0) return;
      renderSchedule(schedule);
      document.getElementById("downloadBtns").style.display = "flex";
      // Excelダウンロードボタンのクリック
      document.getElementById("downloadExcelBtn").onclick = () => downloadExcel(schedule);
      // 画像ダウンロードボタンのクリック
      document.getElementById("downloadImgBtn").onclick = downloadImage;
    });
  </script>
</body>
</html>
