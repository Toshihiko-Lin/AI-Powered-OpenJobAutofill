const els = {
  status: document.getElementById("status"),
  openOptions: document.getElementById("openOptions"),
  startAutofillBtn: document.getElementById("startAutofillBtn"),
  showProfilePanelBtn: document.getElementById("showProfilePanelBtn"),
  clearMarksBtn: document.getElementById("clearMarksBtn"),
  openLearningBtn: document.getElementById("openLearningBtn"),
  updateStatus: document.getElementById("updateStatus"),
  checkUpdateBtn: document.getElementById("checkUpdateBtn"),
  openUpdateBtn: document.getElementById("openUpdateBtn")
};

const DEFAULT_START_LABEL = els.startAutofillBtn.textContent;
const DEFAULT_CHECK_UPDATE_LABEL = els.checkUpdateBtn.textContent;
const DEFAULT_LEARNING_LABEL = els.openLearningBtn.textContent;
// Root-anchored: Firefox resolves relative paths against the popup document (src/), Chrome
// against the extension root. A leading slash means the extension root in both.
const CONTENT_SCRIPT_FILES = ["/src/profile-schema.js", "/src/content.js"];

els.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
els.startAutofillBtn.addEventListener("click", () => {
  void startAutofill();
});
els.showProfilePanelBtn.addEventListener("click", () => {
  void showProfilePanel();
});
els.clearMarksBtn.addEventListener("click", () => {
  void clearMarks();
});
els.openLearningBtn.addEventListener("click", () => {
  void openLearningPanel();
});
els.checkUpdateBtn.addEventListener("click", () => {
  void checkUpdate();
});
els.openUpdateBtn.addEventListener("click", () => {
  void openUpdatePage();
});

initialize();

async function initialize() {
  try {
    setStatus("点击开始填写后，右下角会实时显示当前是本地规则还是 AI；AI 不可用也能继续用本地规则填写。");
    await syncUpdateStatus();
    await syncRuntimeState();
  } catch (error) {
    setStatus(`读取页面失败：${error.message}`, true);
  }
}

async function syncRuntimeState(options = {}) {
  try {
    const response = await sendToActiveTab({ type: "OJAF_GET_RUNTIME_STATE" });
    applyRuntimeState(response?.data || {}, options);
  } catch {
    els.startAutofillBtn.disabled = false;
    els.startAutofillBtn.textContent = DEFAULT_START_LABEL;
  }
}

function applyRuntimeState(state = {}, options = {}) {
  const busy = Boolean(state.autofillInProgress);
  els.startAutofillBtn.disabled = busy;
  els.startAutofillBtn.textContent = busy ? "扫描中..." : DEFAULT_START_LABEL;
  const learningCount = Number(state.learningCount || 0);
  els.openLearningBtn.textContent = learningCount > 0 ? `更新资料库（${learningCount} 处修改）` : DEFAULT_LEARNING_LABEL;

  if (options.updateStatus === false) {
    return;
  }

  if (busy) {
    const progress = state.autofillProgress || {};
    const stageLabel = progress.stepLabel || progress.stage || "处理当前页面";
    const stage = /^正在/.test(stageLabel) ? stageLabel : `正在${stageLabel}`;
    const elapsed = formatElapsedTime(progress.stageStartedAt);
    const aiNote = formatRuntimeAiNote(state.autofillAi || {}, elapsed);
    setStatus(`当前${stage}，请勿重复点击。页面右下角会显示进度。${aiNote}`);
    return;
  }

  if (state.autofillSummary) {
    const summary = state.autofillSummary;
    const missingNote = Number(summary.missing || 0) > 0 ? `，缺资料 ${summary.missing} 项` : "";
    setStatus(`上次填写：已填写 ${summary.filled || 0} 项，待处理 ${getPendingCount(summary)} 项${missingNote}。${formatAiCompletionNote(summary.aiUsage || state.autofillAi || {})}`);
  }
}

async function showProfilePanel() {
  try {
    await sendToActiveTab({ type: "OJAF_SHOW_PROFILE_PANEL" });
    setStatus("已打开资料面板。");
    await syncRuntimeState({ updateStatus: false });
  } catch (error) {
    setStatus(`打开失败：${error.message}`, true);
  }
}

async function startAutofill() {
  try {
    els.startAutofillBtn.disabled = true;
    els.startAutofillBtn.textContent = "扫描中...";
    setStatus("正在开始填写；右下角会显示当前是本地规则还是 AI。");
    const response = await sendToActiveTab({ type: "OJAF_START_AUTOFILL" });
    const data = response?.data || {};
    if (data.ok) {
      if (data.filled != null) {
        const missingNote = Number(data.missing || 0) > 0 ? `，资料库中没有的字段 ${data.missing} 项（橙色虚线）` : "";
        setStatus(`已完成一键填写：已填写 ${data.filled || 0} 项，待处理 ${getPendingCount(data)} 项${missingNote}。${formatAiCompletionNote(data.aiUsage || {})}`);
      } else {
        setStatus("已完成扫描处理。页面上的橙色标记需要手动处理，也可以打开资料面板查看和复制资料。");
      }
    } else if (data.reason === "cancelled") {
      setStatus("已取消填写。");
    } else if (data.reason === "no candidates") {
      setStatus(`没有找到可自动填写的字段。橙色标记需要手动处理（虚线表示资料库中没有该字段），也可以打开资料面板查看和复制资料。${formatAiCompletionNote(data.aiUsage || {})}`);
    } else if (data.reason === "busy") {
      setStatus("当前已有扫描任务在运行，请稍候。", true);
    } else if (data.reason) {
      setStatus(`开始填写未完成：${data.reason}`, true);
    } else {
      setStatus("已开始处理一键填写。");
    }
    await syncRuntimeState({ updateStatus: false });
  } catch (error) {
    setStatus(`开始填写失败：${error.message}`, true);
    await syncRuntimeState({ updateStatus: false });
  }
}

async function openLearningPanel() {
  try {
    const response = await sendToActiveTab({ type: "OJAF_OPEN_LEARNING_PANEL" });
    const count = Number(response?.data?.count || 0);
    setStatus(count > 0 ? `已打开更新资料库面板，共 ${count} 处修改待处理。` : "已打开更新资料库面板。填写完成后在页面上修改或补填的内容会记录在这里。");
    await syncRuntimeState({ updateStatus: false });
  } catch (error) {
    setStatus(`打开失败：${error.message}`, true);
  }
}

async function clearMarks() {
  try {
    await sendToActiveTab({ type: "OJAF_CLEAR_MARKS" });
    setStatus("已清除颜色标记，不会修改表单内容。");
    await syncRuntimeState({ updateStatus: false });
  } catch (error) {
    setStatus(`清除失败：${error.message}`, true);
  }
}

async function syncUpdateStatus() {
  try {
    const state = await sendRuntimeMessage({ type: "OJAF_GET_UPDATE_STATUS" });
    renderUpdateStatus(state || {});
  } catch (error) {
    renderUpdateStatus({ status: "error", error: error.message });
  }
}

async function checkUpdate() {
  els.checkUpdateBtn.disabled = true;
  els.checkUpdateBtn.textContent = "检查中...";
  renderUpdateStatus({ status: "checking" });
  try {
    const state = await sendRuntimeMessage({
      type: "OJAF_CHECK_FOR_UPDATE",
      payload: { reason: "manual-popup" }
    });
    renderUpdateStatus(state || {});
  } catch (error) {
    renderUpdateStatus({ status: "error", error: error.message });
  } finally {
    els.checkUpdateBtn.disabled = false;
    els.checkUpdateBtn.textContent = DEFAULT_CHECK_UPDATE_LABEL;
  }
}

async function openUpdatePage() {
  try {
    await sendRuntimeMessage({ type: "OJAF_OPEN_UPDATE_PAGE" });
    renderUpdateStatus({
      message: "已打开 Release 页面。更新前建议先到设置页导出资料备份；更新时不要卸载扩展，覆盖或重新加载后本机资料和 API 设置会保留。"
    });
  } catch (error) {
    renderUpdateStatus({ status: "error", error: error.message });
  }
}

function renderUpdateStatus(state = {}) {
  if (!els.updateStatus) {
    return;
  }

  els.updateStatus.textContent = formatUpdateStatus(state);
  els.updateStatus.classList.toggle("is-new", state.status === "available");
  els.updateStatus.classList.toggle("error", state.status === "error");
}

function formatUpdateStatus(state = {}) {
  if (state.message) {
    return state.message;
  }
  if (state.status === "checking") {
    return "正在检查 GitHub Release...";
  }
  if (state.status === "available") {
    const version = state.latestVersion ? ` ${state.latestVersion}` : "";
    return `发现新版本${version}。更新前建议先到设置页导出资料备份；点击“打开 Release 页面”下载更新。不要卸载扩展，覆盖或重新加载后本机资料和 API 设置会保留。`;
  }
  if (state.status === "current") {
    return `当前已是最新版本 ${state.currentVersion || chrome.runtime.getManifest().version}。`;
  }
  if (state.status === "error") {
    return `检查更新失败：${state.error || "请稍后重试"}`;
  }
  return `当前版本 ${chrome.runtime.getManifest().version}。插件会定期检查 GitHub Release。`;
}

function formatRuntimeAiNote(aiUsage = {}, elapsed = "") {
  const status = aiUsage.status || "";
  if (status === "trying") {
    return ` 正在用 AI 辅助识别字段，资料值不会发送${elapsed ? `，已等待 ${elapsed}` : ""}。`;
  }
  if (aiUsage.used && aiUsage.fallback) {
    return " AI 辅助识别了部分字段，其余已用本地规则继续。";
  }
  if (aiUsage.used) {
    return " AI 已辅助识别字段，具体填写仍在本机完成。";
  }
  if (aiUsage.fallback) {
    return " AI 不可用，已使用本地规则继续。";
  }
  if (status === "no-result" || aiUsage.attempted) {
    return " AI 没有提供可用建议，继续使用本地规则。";
  }
  return " 如果配置了 AI，会辅助识别字段；否则使用本地规则。";
}

function formatAiCompletionNote(aiUsage = {}) {
  if (aiUsage.used && aiUsage.fallback) {
    return "本次 AI 辅助识别了部分字段，其余使用本地规则完成。";
  }
  if (aiUsage.used) {
    return "本次 AI 辅助识别字段，具体填写在本机完成。";
  }
  if (aiUsage.fallback) {
    return "本次使用本地规则完成；AI 不可用。";
  }
  if (aiUsage.status === "no-result" || aiUsage.attempted) {
    return "本次 AI 没有提供可用建议，实际使用本地规则。";
  }
  return "本次使用本地规则。";
}

function getPendingCount(summary = {}) {
  return Number(summary.pending ?? Number(summary.skipped || 0) + Number(summary.failed || 0));
}

function formatElapsedTime(startedAt) {
  const start = Number(startedAt || 0);
  if (!start) {
    return "";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  if (seconds < 1) {
    return "";
  }
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

async function sendToActiveTab(message) {
  const [tab] = await queryTabs({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  await executeScript(tab.id, CONTENT_SCRIPT_FILES);

  try {
    return await sendTabMessage(tab.id, message);
  } catch (firstError) {
    try {
      await executeScript(tab.id, CONTENT_SCRIPT_FILES);
      return await sendTabMessage(tab.id, message);
    } catch {
      throw firstError;
    }
  }
}

function queryTabs(query) {
  return new Promise((resolve) => {
    chrome.tabs.query(query, resolve);
  });
}

function executeScript(tabId, files) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files: Array.isArray(files) ? files : [files] }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve();
      }
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Tab message failed."));
        return;
      }
      resolve(response);
    });
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Runtime message failed."));
        return;
      }
      resolve(response.data);
    });
  });
}
