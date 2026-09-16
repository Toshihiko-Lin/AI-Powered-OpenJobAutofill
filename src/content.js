(() => {
  const SCRIPT_VERSION = "0.9.0-learn-from-edits";

  if (window.__OJAF_AUTOFILL_VERSION__ === SCRIPT_VERSION) {
    return;
  }

  window.__OJAF_AUTOFILL_VERSION__ = SCRIPT_VERSION;
  window.__OJAF_AUTOFILL_LOADED__ = true;

  const FIELD_ATTR = "data-ojaf-field-id";
  const MARK_ATTR = "data-ojaf-mark";
  const EDIT_ATTEMPT_ATTR = "data-ojaf-edit-attempted";
  const STYLE_ID = "ojaf-autofill-style";
  const PANEL_ID = "ojaf-profile-panel";
  const FLOAT_ID = "ojaf-floating-status";
  const LEARNING_PANEL_ID = "ojaf-learning-panel";
  const LEARNING_DIFF_DEBOUNCE_MS = 400;
  const LEARNING_SYNC_DEBOUNCE_MS = 500;
  const PROFILE_SCHEMA = Array.isArray(globalThis.OJAF_PROFILE_SCHEMA) ? globalThis.OJAF_PROFILE_SCHEMA : [];
  const PANEL_HIDDEN_ATTR = "data-ojaf-hidden";
  const PANEL_COLLAPSED_ATTR = "data-ojaf-collapsed";
  const MAX_EDIT_EXPANSIONS = 20;
  const PROFILE_PANEL_STATE_DEBOUNCE_MS = 300;
  let fieldCounter = 0;
  let profilePanelVisible = false;
  let profilePanelCollapsed = false;
  let profilePanel = null;
  let profilePanelStateSaveTimer = null;
  let profilePanelStateRestored = false;
  let currentProfileV2 = null;
  let currentProfileLoadPromise = null;
  let currentSiteAdapter = null;
  let sidebarFilter = "";
  let activeProfileCategory = "";
  let autofillInProgress = false;
  let autofillProgress = { active: false, stage: "", percent: 0, detail: "" };
  let autofillSummary = null;
  let lastAutofillDebug = null;
  let autofillRunId = 0;
  let autofillProgressTimer = null;
  let autofillAiState = createAutofillAiState();
  let learningBaseline = null;
  let learningRecords = [];
  let learningOtherRecords = [];
  let learningTrackingEnabled = true;
  let learningAutoClassify = true;
  let aiValueMatchingEnabled = false;
  let currentApiUsable = false;
  const aiOptionMatchCache = new Map();
  let learningListenersAttached = false;
  let learningSyncTimer = null;
  let learningDiffTimers = new Map();
  let learningPanel = null;
  let learningPanelBusy = false;

  const CONTROL_SELECTOR = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
    "textarea",
    "select",
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="radio"]',
    '[role="checkbox"]'
  ].join(",");

  const SITE_ADAPTERS = [
    {
      id: "zhiye",
      name: "智易/智业 ATS",
      urlPattern: /(?:^|\.)zhiye\.com$/i,
      confidence: 0.94,
      indicators: [".ant-form-item", ".ant-select", "[class*='form-item']", "[class*='FormItem']"],
      containerSelector: ".ant-form-item,.form-item,[class*='formItem'],[class*='FormItem'],[class*='field'],[class*='Field']",
      labelSelector: ".ant-form-item-label,label,[class*='label'],[class*='Label'],[class*='formLabel']",
      sectionSelector: ".ant-card-head-title,.ant-collapse-header,.form-section-title,[class*='sectionTitle'],[class*='module-title'],h2,h3,h4",
      repeatItemSelector: ".ant-card,.ant-collapse-item,.resume-block,[class*='list-item'],[class*='resume-item'],[class*='record-item']",
      saveLabels: ["保存", "确定", "完成"],
      editLabels: ["编辑", "修改", "完善"]
    },
    {
      id: "hotjob",
      name: "HotJob",
      urlPattern: /(?:^|\.)hotjob\.cn$/i,
      confidence: 0.92,
      indicators: [".form-item", ".resume-block", "[class*='kuma']", "[class*='uxcore']"],
      containerSelector: ".form-item,.kuma-form-item,.uxcore-form-row,[class*='form-item'],[class*='field']",
      labelSelector: ".kuma-label,.form-label,label,[class*='label']",
      sectionSelector: ".module-title,.resume-title,.card-title,.uxcore-card-title-text,h2,h3,h4",
      repeatItemSelector: ".resume-block,.uxcore-card,[class*='resume-item'],[class*='experience-item'],[class*='list-item']",
      saveLabels: ["保存", "确定", "提交"],
      editLabels: ["编辑", "修改"]
    },
    {
      id: "liepin",
      name: "猎聘/通用 ATS",
      urlPattern: /(?:^|\.)liepin\.com$/i,
      confidence: 0.86,
      indicators: [".form-item", "[class*='resume']", "[class*='apply']"],
      containerSelector: ".form-item,[class*='formItem'],[class*='field'],[class*='apply']",
      labelSelector: "label,[class*='label'],[class*='Label']",
      sectionSelector: "[class*='title'],[class*='Title'],h2,h3,h4",
      repeatItemSelector: "[class*='resume-item'],[class*='experience-item'],[class*='list-item'],[class*='record-item']",
      saveLabels: ["保存", "确定"],
      editLabels: ["编辑", "修改"]
    },
    {
      id: "moka",
      name: "Moka 招聘",
      urlPattern: /(?:^|\.)(?:mokahr|moka)\.com$/i,
      confidence: 0.9,
      indicators: [".ant-form-item", "[class*='application-form']", "[class*='questionnaire']", "[class*='schema-form']"],
      containerSelector: ".ant-form-item,[class*='form-item'],[class*='field-wrapper'],[class*='question-item'],[class*='schema-form-item']",
      labelSelector: ".ant-form-item-label,label,[class*='field-label'],[class*='question-label'],[class*='question-title']",
      sectionSelector: ".ant-card-head-title,[class*='module-title'],[class*='questionnaire-title'],[class*='block-title'],h2,h3,h4",
      repeatItemSelector: ".ant-card,[class*='resume-item'],[class*='experience-item'],[class*='list-item'],[class*='card-item']",
      saveLabels: ["保存", "确定", "下一步", "完成"],
      editLabels: ["编辑", "修改", "完善"]
    },
    {
      id: "beisen",
      name: "北森/iTalentX",
      urlPattern: /(?:^|\.)beisen\.com$|(?:^|\.)italent\.cn$|(?:^|\.)italentx\.cn$|(?:^|\.)italentx\.com$/i,
      confidence: 0.89,
      indicators: [".el-form-item", ".ant-form-item", "[class*='resume-form']", "[class*='talent-form']", "[class*='bs-']"],
      containerSelector: ".el-form-item,.ant-form-item,[class*='form-item'],[class*='resume-field'],[class*='field-row']",
      labelSelector: ".el-form-item__label,.ant-form-item-label,label,[class*='field-label'],[class*='label']",
      sectionSelector: ".el-card__header,[class*='block-title'],[class*='section-title'],[class*='module-title'],h2,h3,h4",
      repeatItemSelector: ".el-card,[class*='resume-item'],[class*='experience-item'],[class*='list-item'],[class*='record-item']",
      saveLabels: ["保存", "确定", "下一步", "完成"],
      editLabels: ["编辑", "修改", "完善", "填写"]
    },
    {
      id: "nowcoder",
      name: "牛客网申",
      urlPattern: /(?:^|\.)nowcoder\.com$/i,
      confidence: 0.84,
      indicators: [".ant-form-item", "[class*='questionnaire']", "[class*='resume-module']", "[class*='form-item']"],
      containerSelector: ".ant-form-item,[class*='form-item'],[class*='question-item'],[class*='resume-field']",
      labelSelector: ".ant-form-item-label,label,[class*='field-label'],[class*='question-title'],[class*='label']",
      sectionSelector: ".ant-card-head-title,[class*='module-title'],[class*='questionnaire-title'],[class*='resume-title'],h2,h3,h4",
      repeatItemSelector: ".ant-card,[class*='resume-item'],[class*='experience-item'],[class*='list-item']",
      saveLabels: ["保存", "确定", "下一步", "完成"],
      editLabels: ["编辑", "修改", "完善"]
    },
    {
      id: "zhaopin",
      name: "智联招聘",
      urlPattern: /(?:^|\.)zhaopin\.com$/i,
      confidence: 0.83,
      indicators: [".ant-form-item", "[class*='resume-edit']", "[class*='questionnaire']", "[class*='form-item']"],
      containerSelector: ".ant-form-item,[class*='form-item'],[class*='resume-field'],[class*='field-row']",
      labelSelector: ".ant-form-item-label,label,[class*='field-label'],[class*='label']",
      sectionSelector: ".ant-card-head-title,[class*='module-title'],[class*='resume-title'],[class*='section-title'],h2,h3,h4",
      repeatItemSelector: ".ant-card,[class*='resume-module'],[class*='resume-item'],[class*='list-item']",
      saveLabels: ["保存", "确定", "下一步", "完成"],
      editLabels: ["编辑", "修改", "完善"]
    },
    {
      id: "feishu-jobs",
      name: "飞书招聘",
      urlPattern: /(?:^|\.)jobs\.feishu\.cn$/i,
      confidence: 0.82,
      indicators: [".ud-formily-item", "[class*='applyFormModuleWrapper']", "[data-form-field-id]", "[data-form-field-name]"],
      containerSelector: ".ud-formily-item,[class*='applyFormModuleWrapper'],[class*='form-item'],[class*='field']",
      labelSelector: ".ud-formily-item-label-content,label,[class*='label'],[data-form-field-i18n-name]",
      sectionSelector: ".applyFormModuleWrapper-text,[class*='module-title'],[class*='section-title'],h2,h3,h4",
      repeatItemSelector: "[class*='applyFormModuleWrapper'],[class*='list-item'],[class*='record-item'],[class*='card-item']",
      saveLabels: ["保存", "确定", "下一步", "完成"],
      editLabels: ["编辑", "修改", "完善"]
    },
    {
      id: "ant-design",
      name: "Ant Design 表单",
      confidence: 0.78,
      indicators: [".ant-form-item", ".ant-select", ".ant-radio-wrapper"],
      containerSelector: ".ant-form-item,.ant-row.ant-form-item,[class*='ant-form-item']",
      labelSelector: ".ant-form-item-label,label,.ant-checkbox-wrapper,.ant-radio-wrapper",
      sectionSelector: ".ant-card-head-title,.ant-collapse-header,.ant-tabs-tab,.ant-typography,h2,h3,h4",
      repeatItemSelector: ".ant-card,.ant-collapse-item,[class*='list-item'],[class*='record-item'],[class*='card-item']",
      saveLabels: ["保存", "确定", "完成"],
      editLabels: ["编辑", "修改"]
    },
    {
      id: "arco-design",
      name: "Arco Design 表单",
      confidence: 0.77,
      indicators: [".arco-form-item", ".arco-select-view", ".arco-radio"],
      containerSelector: ".arco-form-item,[class*='arco-form-item']",
      labelSelector: ".arco-form-item-label,label,.arco-radio,.arco-checkbox",
      sectionSelector: ".arco-card-header,[class*='section-title'],[class*='module-title'],h2,h3,h4",
      repeatItemSelector: ".arco-card,[class*='list-item'],[class*='record-item'],[class*='card-item']",
      saveLabels: ["保存", "确定", "完成"],
      editLabels: ["编辑", "修改"]
    },
    {
      id: "element-ui",
      name: "Element UI 表单",
      confidence: 0.76,
      indicators: [".el-form-item", ".el-select", ".el-radio"],
      containerSelector: ".el-form-item,[class*='el-form-item']",
      labelSelector: ".el-form-item__label,label,.el-checkbox,.el-radio",
      sectionSelector: ".el-card__header,.el-collapse-item__header,[class*='title'],h2,h3,h4",
      repeatItemSelector: ".el-card,.el-collapse-item,[class*='list-item'],[class*='record-item'],[class*='card-item']",
      saveLabels: ["保存", "确定", "完成"],
      editLabels: ["编辑", "修改"]
    },
    {
      id: "tdesign",
      name: "TDesign 表单",
      confidence: 0.75,
      indicators: [".t-form__item", ".t-select", ".t-radio"],
      containerSelector: ".t-form__item,[class*='t-form__item']",
      labelSelector: ".t-form__label,label,.t-radio,.t-checkbox",
      sectionSelector: ".t-card__header,[class*='section-title'],[class*='module-title'],h2,h3,h4",
      repeatItemSelector: ".t-card,[class*='list-item'],[class*='record-item'],[class*='card-item']",
      saveLabels: ["保存", "确定", "完成"],
      editLabels: ["编辑", "修改"]
    }
  ];

  const AUTO_FILL_SECTION_ORDER = [
    "基本信息",
    "求职意向",
    "教育经历",
    "实习经历",
    "工作经历",
    "绩效考核",
    "专业资格",
    "项目经历",
    "社团工作",
    "学生工作",
    "奖惩情况",
    "外语能力",
    "计算机技能",
    "证书技能",
    "语言能力",
    "家庭信息",
    "培训经历",
    "论文著作",
    "专利成果",
    "自我描述",
    "有关声明",
    "其他信息",
    "自定义资料"
  ];

  const PROFILE_LABEL_ALIASES = {
    姓名: ["真实姓名", "名字"],
    姓: ["姓氏", "中文姓"],
    名: ["名字", "中文名"],
    姓拼音: ["姓（拼音）", "姓氏拼音", "拼音姓", "Last Name Pinyin"],
    名拼音: ["名（拼音）", "名字拼音", "拼音名", "First Name Pinyin"],
    性别: ["男女性别"],
    英文名: ["英文姓名", "英文名称", "English Name"],
    出生日期: ["生日", "出生年月", "出生时间", "出生年月日"],
    国籍: ["国家", "国籍地区", "国籍国家或地区", "国籍（国家或地区）"],
    证件类型: ["身份证件类型", "证件类别", "证件号码类型"],
    证件号码类型: ["证件类型", "身份证件类型", "证件类别"],
    证件号码: ["身份证号", "身份证号码", "证件号", "身份证", "居民身份证号码"],
    婚姻状况: ["婚姻状态"],
    最高全日制学历: ["最高学历", "学历", "学历层次"],
    最高学历: ["最高全日制学历", "学历", "学历层次"],
    培养方式: ["教育类型", "学习形式", "办学形式", "统招统分"],
    教育类型: ["培养方式", "学习形式", "办学形式", "是否全日制"],
    学习形式: ["培养方式", "教育类型"],
    是否全日制: ["全日制", "是否为全日制"],
    专业排名: ["绩点排名", "GPA排名", "成绩排名", "排名"],
    绩点排名: ["专业排名", "GPA排名", "成绩排名", "排名"],
    班级排名: ["班级成绩排名"],
    无班级排名原因: ["没有班级排名的原因", "请写明没有班级排名的原因"],
    无专业排名原因: ["没有专业排名的原因", "请写明没有专业排名的原因"],
    GPA分数: ["GPA", "平均学分成绩", "平均学分成绩GPA", "绩点"],
    GPA满分: ["GPA满分", "绩点满分", "4分制"],
    身高厘米: ["身高", "净身高", "身高cm", "身高厘米"],
    体重公斤: ["体重", "体重kg", "体重公斤"],
    手机号码: ["手机号", "手机", "联系电话", "联系方式", "电话号码"],
    电话: ["手机号码", "手机号", "手机", "联系电话", "联系方式"],
    邮箱: ["电子邮箱", "邮件", "email", "e-mail"],
    确认邮箱: ["确认电子邮箱", "再次输入邮箱"],
    微信: ["微信号", "微信账号", "WeChat"],
    QQ: ["QQ号", "QQ号码"],
    民族: ["民族"],
    政治面貌: ["政治身份"],
    取得政治面貌时间: ["政治面貌取得时间", "入党时间", "入团时间"],
    户籍: ["户口所在地", "户籍所在地", "现户口所在地"],
    生源地: ["生源户口", "生源所在地", "生源地省", "生源地市"],
    现居住地: ["当前居住地", "居住地", "现居地", "所在地", "现居住城市"],
    现居住城市: ["现居住地", "当前居住城市", "居住城市"],
    现居住详细地址: ["当前居住地详细地址", "现居住地址", "居住地址", "现住址", "当前地址"],
    通讯地址: ["通信地址", "邮寄地址", "收件地址"],
    联系地址: ["通讯地址", "通信地址", "邮寄地址", "收件地址"],
    邮编: ["邮政编码"],
    邮政编码: ["邮编"],
    现户口所在地: ["当前户口所在地", "户口所在地", "户籍所在地"],
    户口类型: ["户籍类型"],
    户籍类型: ["户口类型"],
    人事档案所在单位: ["档案所在单位", "档案单位"],
    血型: ["血液类型"],
    健康状况: ["身体状况"],
    高考时间: ["参加高考时间"],
    高考科目: ["文理科", "高考文理科"],
    工作年限: ["工作经验年限", "工作经验"],
    专业技术职称: ["技术职称", "职称"],
    紧急联系人电话: ["紧急联系人手机", "紧急联系人手机号", "紧急联系方式"],
    与紧急联系人关系: ["紧急联系人关系", "紧急联系人与本人关系"],
    意向岗位: ["目标岗位", "应聘岗位", "申请岗位", "投递岗位"],
    预计入职时间: ["可入职时间", "到岗时间"],
    当前薪资: ["目前薪资", "现薪资"],
    当前年收入: ["目前年收入", "现年收入", "当前年薪", "目前年薪"],
    期望工作城市: ["意向工作城市", "期望城市", "意向城市", "期望工作地点"],
    期望薪资: ["期望年薪", "期望月薪", "期望年收入", "期待薪资"],
    期望年收入: ["期望薪资", "期望年薪", "期待年收入"],
    面试城市: ["可面试城市"],
    简历来源: ["招聘信息来源", "信息来源"],
    即将获得最高学历: ["最高学历", "学历"],
    最高学历院校: ["最高学历学校", "毕业院校", "学校名称", "院校名称"],
    最高学历院系: ["最高学历学院", "学院名称", "院系", "院系名称"],
    本科毕业院校: ["本科院校", "本科毕业学校"],
    本科院系: ["本科专业院系", "本科院系名称"],
    专业名称: ["专业", "所学专业", "专业方向"],
    专业类型: ["专业", "专业名称", "所学专业", "学科专业"],
    学校名称: ["毕业院校", "院校名称", "学校"],
    学校所在国家地区: ["学校所在国家/地区", "学校国家地区", "学校国家"],
    学院名称: ["院系", "院系名称", "学院"],
    院系中文: ["院系（中文）", "院系", "学院名称", "院系名称"],
    学历: ["学历层次", "最高学历"],
    学位: ["学位类型"],
    学历学位: ["学历/学位", "学历学位", "最高学历学位"],
    学号: ["学生证号"],
    学制: ["学习年限", "几年制"],
    城市: ["所在城市", "学校城市", "地点"],
    学校类别: ["院校类别", "学校类型"],
    录取批次: ["高考录取批次", "招生批次"],
    专业描述: ["专业介绍"],
    专业课程: ["主修课程", "核心课程"],
    研究方向: ["研究领域"],
    毕业论文: ["论文题目", "毕业论文题目"],
    成绩: ["学习成绩", "GPA分数", "平均成绩"],
    学历证书编号: ["学历证书号", "毕业证书编号"],
    学历证书号: ["学历证书编号", "毕业证书编号"],
    学位证书编号: ["学位证书号"],
    毕业状态: ["毕（结、肆）业", "毕结肆业"],
    "毕（结、肆）业": ["毕业状态", "毕结肆业"],
    辅导员姓名: ["辅导员"],
    辅导员联系方式: ["辅导员电话", "辅导员手机号"],
    是否为海外教育经历: ["是否海外教育经历", "是否海外学历", "海外教育经历"],
    开始时间: ["起始时间", "入学时间", "开始日期", "实践开始时间"],
    结束时间: ["截止时间", "毕业时间", "结束日期", "实践结束时间", "取得毕业证时间"],
    升学类型: ["本段经历升学类型", "入学方式"],
    高考所在地: ["高考省份", "高考所在地"],
    高考分数: ["高考成绩", "分数"],
    高考总分: ["高考总分数", "总分数"],
    是否有转学经历: ["转学经历", "有无转学经历"],
    单位名称: ["公司名称", "公司", "实习单位", "实践单位", "工作单位", "组织名称"],
    公司: ["公司名称", "单位名称", "实习单位", "工作单位"],
    类型: ["经历类型", "工作实习类型"],
    是否目标公司实习: ["是否为应聘单位实习", "是否为目标公司实习"],
    部门: ["部门名称", "所在部门"],
    职位名称: ["岗位", "岗位名称", "实习岗位", "职务名称", "角色"],
    职位: ["职务", "岗位", "职位名称", "家属职务", "亲属职务"],
    工作实习地点: ["工作/实习地点", "工作地点", "实习地点"],
    地点: ["工作地点", "实习地点", "项目地点", "培训地点"],
    工资: ["薪资", "实习工资", "月薪"],
    行业属性: ["行业", "所属行业"],
    行业: ["行业属性", "所属行业"],
    其他行业属性: ["请填写其他行业属性"],
    实习内容: ["实践内容", "工作内容", "工作内容描述", "职责描述", "工作职责", "项目描述"],
    工作内容: ["工作内容描述", "职责描述", "工作职责", "实践内容"],
    工作成果: ["实习成果", "工作业绩", "项目成果"],
    证明人: ["证明人姓名", "推荐人"],
    证明人姓名: ["证明人", "推荐人"],
    证明人职位: ["证明人职务"],
    证明人联系方式: ["证明人电话", "证明人手机号", "证明人及联系方式"],
    离职原因: ["离开原因"],
    项目名称: ["项目", "实践名称"],
    参与人数: ["项目人数", "团队人数"],
    项目内容: ["项目描述", "实践内容"],
    实践方式: ["实践类型", "活动方式"],
    本人职责: ["个人职责", "本人负责内容", "职责"],
    项目成果: ["项目产出", "实践成果"],
    项目链接: ["项目地址", "作品链接"],
    部门名称社团名称: ["部门名称", "社团名称", "组织名称"],
    组织名称: ["社团名称", "学生组织", "部门名称"],
    职务描述: ["职责", "活动描述", "工作职责或活动描述"],
    奖惩时间: ["获奖时间", "奖励时间"],
    奖惩解除时间: ["解除时间", "处分解除时间"],
    奖惩名称: ["奖励名称", "奖项名称", "荣誉名称"],
    颁奖单位: ["授奖单位", "奖惩单位", "颁发单位"],
    奖惩单位: ["颁奖单位", "授奖单位", "授予单位"],
    奖励等级: ["奖项等级", "奖励级别", "奖惩层级"],
    奖惩层级: ["奖励等级", "奖项等级", "奖励级别"],
    奖惩描述: ["获奖描述", "奖励描述", "奖惩原因"],
    奖惩原因: ["奖惩描述", "获奖描述", "奖励描述"],
    证书: ["证书名称", "资格证书", "技能证书"],
    证书名称技能名称: ["证书名称（技能名称）", "证书名称", "技能名称"],
    证书类别: ["证书类型", "资格证书类别"],
    外语种类: ["外语语种", "语言类型", "语种"],
    获得时间: ["获取日期", "取得时间", "证书取得时间", "获得日期"],
    证书获得时间: ["证书取得时间", "获得时间", "取得时间"],
    其他类请填写: ["其他证书", "其他证书名称"],
    证书颁发单位: ["发证机构", "颁发单位"],
    授予单位: ["颁发单位", "证书颁发单位", "发证机构"],
    发证单位: ["授予单位", "颁发单位", "证书颁发单位", "发证机构"],
    证书编号: ["证书号码"],
    证书说明: ["证书描述", "证书备注"],
    获取日期: ["取得时间", "证书取得时间", "获得日期"],
    竞赛项目: ["竞赛名称", "比赛项目"],
    竞赛奖项: ["奖项", "竞赛级别"],
    竞赛时间: ["比赛时间", "获奖时间"],
    计算机水平: ["计算机能力", "计算机技能"],
    其它技能: ["其他技能", "技能特长"],
    语言类型: ["外语语种", "语种"],
    掌握程度: ["熟练程度", "语言水平", "外语水平"],
    听说: ["听说能力"],
    读写: ["读写能力"],
    培训名称: ["培训项目", "课程名称"],
    培训机构: ["培训单位"],
    培训地点: ["培训城市", "培训地址"],
    培训课程: ["培训内容", "课程内容"],
    培训获得证书: ["培训证书"],
    培训内容: ["培训描述"],
    刊物名称: ["期刊名称", "发表刊物"],
    刊物层级: ["期刊层级"],
    论文名称: ["论文题目", "文章名称"],
    论文描述: ["论文摘要", "论文说明"],
    专利名称: ["专利题目"],
    专利编号: ["专利号"],
    专利类型: ["发明专利", "实用新型"],
    专利成果: ["专利描述", "专利说明"],
    与本人关系: ["关系", "亲属关系"],
    亲属在应聘单位工作: ["是否存在亲属在应聘单位工作"],
    工作单位: ["家属工作单位", "亲属工作单位"],
    部门及职位: ["家属职务", "亲属职务", "职务"],
    联系电话: ["家属联系电话", "亲属联系电话"],
    有无工作经历: ["是否有工作经历", "工作经历"],
    是否退休: ["有无退休", "退休情况"],
    考核年度: ["绩效年度", "年度考核"],
    绩效考核等级: ["考核等级", "年度绩效考核等级"],
    年度绩效排名: ["绩效排名", "考核排名", "排名"],
    绩效证明人: ["考核证明人", "证明人"],
    绩效证明人联系方式: ["证明人联系方式", "联系方式", "联系电话"],
    绩效说明: ["考核说明", "绩效评语"],
    兴趣爱好: ["爱好", "特长爱好具体内容"],
    特长: ["个人特长", "技能特长"],
    社会校园活动: ["社会/校园活动", "校园活动", "社会活动"],
    受到奖励学术成果: ["受到奖励/学术成果", "奖励学术成果", "奖励成果", "学术成果"],
    工作地点是否服从调剂: ["是否接受调剂", "是否服从调剂", "接受调剂"],
    是否同意部门岗位调配: ["是否同意部门/岗位调配", "部门岗位调配", "岗位调配"],
    首选工作地点: ["第一工作地点", "意向工作地点"],
    首选工作地点是否接受调剂: ["工作地点是否接受调剂", "地点调剂"],
    是否存在亲属在应聘单位工作: ["亲属在应聘单位工作", "是否存在亲属在本行工作情况", "亲属在本行工作", "亲属在我行工作"],
    是否患有影响工作的疾病: ["是否患有传染病高血压心脏病糖尿病肾炎精神病等影响工作的疾病", "是否患有重大疾病"],
    是否在第三方企业任兼职或持有企业股权: ["是否在第三方企业任兼职或持有企业股权", "任兼职或持有企业股权"],
    是否存在曾被用人单位辞退情况: ["曾被用人单位辞退情况", "是否曾被用人单位辞退"],
    是否享有境外长期或永久居留权: ["是否享有境外国家或地区长期或永久居留权", "境外长期或永久居留权"]
  };

  function normalizeText(value, maxLength = 260) {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim();
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    return true;
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function getPageKey() {
    return `${location.origin}${location.pathname}${location.search}`;
  }

  function detectSiteAdapter() {
    const hostname = location.hostname || "";
    const href = location.href || "";
    const scoreMap = new Map();

    for (const adapter of SITE_ADAPTERS) {
      let score = 0;
      const hasUrlPattern = Boolean(adapter.urlPattern);
      const urlMatched = hasUrlPattern && (adapter.urlPattern.test(hostname) || adapter.urlPattern.test(href));
      if (urlMatched) {
        score += 70;
      }

      for (const indicator of adapter.indicators || []) {
        try {
          if (document.querySelector(indicator)) {
            score += 8;
          }
        } catch {
          // Ignore invalid selectors from future compatibility probes.
        }
      }

      if (score > 0) {
        scoreMap.set(adapter, { score, urlMatched, hasUrlPattern });
      }
    }

    const scored = Array.from(scoreMap.entries())
      .map(([adapter, meta]) => {
        const baseConfidence =
          meta.hasUrlPattern && !meta.urlMatched
            ? Math.min(adapter.confidence || 0.7, 0.62)
            : adapter.confidence || 0.7;
        return {
          ...adapter,
          confidence: Math.min(0.99, baseConfidence + meta.score / 100)
        };
      })
      .sort((left, right) => right.confidence - left.confidence);

    return scored[0] || null;
  }

  function getActiveSiteAdapter() {
    if (currentSiteAdapter) {
      return currentSiteAdapter;
    }
    currentSiteAdapter = detectSiteAdapter();
    return currentSiteAdapter;
  }

  function getAdapterSelectors() {
    const adapter = getActiveSiteAdapter();
    return {
      containerSelector: adapter?.containerSelector || "",
      labelSelector: adapter?.labelSelector || "",
      sectionSelector: adapter?.sectionSelector || "",
      repeatItemSelector: adapter?.repeatItemSelector || "",
      saveLabels: Array.isArray(adapter?.saveLabels) ? adapter.saveLabels : ["保存"],
      editLabels: Array.isArray(adapter?.editLabels) ? adapter.editLabels : ["编辑", "修改"]
    };
  }

  function getAdapterActionLabels(action) {
    const selectors = getAdapterSelectors();
    if (action === "save") {
      return selectors.saveLabels;
    }
    if (action === "edit") {
      return selectors.editLabels;
    }
    return ["保存"];
  }

  function normalizeProgressPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function setAutofillProgress(stage, percent, detail = "", active = true) {
    const normalizedStage = normalizeText(stage || "", 80);
    const now = Date.now();
    const previous = autofillProgress || {};
    const sameStage = previous.active && previous.stage === normalizedStage;
    const step = getAutofillProgressStep(normalizedStage);
    autofillProgress = {
      active: Boolean(active),
      stage: normalizedStage,
      percent: normalizeProgressPercent(percent),
      detail: normalizeText(detail || "", 160),
      stepIndex: step.index,
      stepTotal: step.total,
      stepLabel: step.label,
      startedAt: previous.active && previous.startedAt ? previous.startedAt : now,
      stageStartedAt: sameStage && previous.stageStartedAt ? previous.stageStartedAt : now
    };

    renderFloatingStatus();
    if (profilePanelVisible) {
      renderProfilePanel();
    }
    updateAutofillProgressTimer();
  }

  function clearAutofillProgress(detail = "") {
    autofillInProgress = false;
    autofillProgress = { active: false, stage: "", percent: 0, detail: normalizeText(detail || "", 160) };
    renderFloatingStatus();
    if (profilePanelVisible) {
      renderProfilePanel();
    }
    updateAutofillProgressTimer();
  }

  function getAutofillProgressStep(stage) {
    const text = normalizeText(stage || "", 80);
    if (/读取本机资料|开始填写|扫描页面并准备填写/.test(text)) {
      return { index: 1, total: 6, label: "准备本机资料" };
    }
    if (/扫描当前页面/.test(text)) {
      return { index: 2, total: 6, label: "扫描当前页面" };
    }
    if (/整理表单字段|AI 识别表单字段/.test(text)) {
      return { index: 3, total: 6, label: "整理表单字段" };
    }
    if (/AI 匹配字段|本地兜底匹配|匹配本地资料|AI 识别字段|整理匹配结果|匹配完成/.test(text)) {
      return { index: 4, total: 6, label: "匹配你的资料" };
    }
    if (/填写匹配项/.test(text)) {
      return { index: 5, total: 6, label: "填写表单" };
    }
    return { index: 6, total: 6, label: "完成复核" };
  }

  function updateAutofillProgressTimer() {
    if (autofillProgress.active) {
      if (!autofillProgressTimer) {
        autofillProgressTimer = window.setInterval(() => {
          renderFloatingStatus();
          if (profilePanelVisible) {
            renderProfilePanel();
          }
        }, 1000);
      }
      return;
    }

    if (autofillProgressTimer) {
      window.clearInterval(autofillProgressTimer);
      autofillProgressTimer = null;
    }
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

  function createAutofillAiState() {
    return {
      status: "idle",
      attempted: false,
      used: false,
      fallback: false,
      currentPhase: "",
      usedPhases: [],
      fallbackReasons: [],
      notes: []
    };
  }

  function resetAutofillAiState() {
    autofillAiState = createAutofillAiState();
  }

  function appendUniqueText(list, value, maxLength = 160) {
    const text = normalizeText(value || "", maxLength);
    if (!text || list.includes(text)) {
      return list;
    }
    return [...list, text];
  }

  function normalizeAutofillAiReason(reason) {
    return {
      phase: normalizeText(reason?.phase || "", 60),
      reason: normalizeText(reason?.reason || "", 180)
    };
  }

  function formatErrorMessage(error) {
    if (!error) {
      return "未知错误";
    }
    if (error instanceof Error) {
      return normalizeText(error.message || String(error), 180);
    }
    return normalizeText(String(error), 180);
  }

  function setAutofillAiTrying(phase) {
    autofillAiState = {
      ...autofillAiState,
      status: "trying",
      attempted: true,
      currentPhase: normalizeText(phase || "AI 优先匹配", 60)
    };
    renderFloatingStatus();
  }

  function setAutofillAiUsed(phase) {
    const phaseText = normalizeText(phase || "AI 优先匹配", 60);
    autofillAiState = {
      ...autofillAiState,
      status: autofillAiState.fallback ? "partial" : "used",
      attempted: true,
      used: true,
      currentPhase: "",
      usedPhases: appendUniqueText(autofillAiState.usedPhases || [], phaseText, 60)
    };
    renderFloatingStatus();
  }

  function setAutofillAiNoResult(phase, note) {
    const phaseText = normalizeText(phase || "AI 优先匹配", 60);
    const notes = appendUniqueText(autofillAiState.notes || [], note || `${phaseText}未返回可用建议`, 160);
    let status = "no-result";
    if (autofillAiState.used && autofillAiState.fallback) {
      status = "partial";
    } else if (autofillAiState.used) {
      status = "used";
    } else if (autofillAiState.fallback) {
      status = "fallback";
    }
    autofillAiState = {
      ...autofillAiState,
      status,
      attempted: true,
      currentPhase: "",
      notes
    };
    renderFloatingStatus();
  }

  function setAutofillAiFallback(phase, error) {
    const phaseText = normalizeText(phase || "AI 优先匹配", 60);
    const reason = formatErrorMessage(error);
    const nextReason = normalizeAutofillAiReason({ phase: phaseText, reason });
    const fallbackReasons = (autofillAiState.fallbackReasons || [])
      .map(normalizeAutofillAiReason)
      .filter((item) => item.phase || item.reason);
    const duplicate = fallbackReasons.some((item) => item.phase === nextReason.phase && item.reason === nextReason.reason);
    autofillAiState = {
      ...autofillAiState,
      status: autofillAiState.used ? "partial" : "fallback",
      attempted: true,
      fallback: true,
      currentPhase: "",
      fallbackReasons: duplicate ? fallbackReasons : [...fallbackReasons, nextReason]
    };
    renderFloatingStatus();
  }

  function formatAutofillAiFallbackReasons(state = autofillAiState) {
    const reasons = Array.isArray(state?.fallbackReasons) ? state.fallbackReasons : [];
    return reasons
      .map(normalizeAutofillAiReason)
      .filter((item) => item.phase || item.reason)
      .map((item) => `${item.phase || "AI"}：${item.reason || "未知错误"}`)
      .join("；");
  }

  function getAutofillAiStatusText(state = autofillAiState) {
    const status = state?.status || "idle";
    const usedPhases = Array.isArray(state?.usedPhases) ? state.usedPhases.filter(Boolean).join("、") : "";
    const fallbackReasons = formatAutofillAiFallbackReasons(state);

    if (status === "trying") {
      return `正在用 AI 优先匹配字段，只发送字段名称，不发送资料值。`;
    }
    if (state?.used && state?.fallback) {
      return `AI 已优先匹配部分字段，本地规则已兜底补齐其余字段${fallbackReasons ? `：${fallbackReasons}` : ""}。`;
    }
    if (state?.used) {
      return `AI 已优先匹配字段${usedPhases ? `（${usedPhases}）` : ""}，资料取值和填写仍在本机完成。`;
    }
    if (state?.fallback) {
      return `AI 不可用，已切换到本地规则兜底${fallbackReasons ? `：${fallbackReasons}` : ""}。`;
    }
    if (status === "no-result" || state?.attempted) {
      return "AI 没有提供可用匹配，本次改用本地规则兜底。";
    }
    return "未调用 AI，本次使用本地规则。";
  }

  function getAutofillModeBadgeText(state = autofillAiState, progress = autofillProgress) {
    const status = state?.status || "idle";
    const phase = normalizeText(state?.currentPhase || "", 60);
    const stage = normalizeText(progress?.stage || "", 80);
    const localMatching = /本地兜底匹配|匹配本地资料|整理匹配结果|匹配完成/.test(stage);

    if (status === "trying") {
      if (/字段理解/.test(phase)) {
        return "AI · 正在优先匹配字段";
      }
      return "AI · 正在分析页面结构";
    }
    if (state?.used && state?.fallback) {
      return localMatching ? "AI 优先匹配 · 本地规则兜底" : "AI 优先匹配 + 本地规则兜底";
    }
    if (state?.fallback) {
      return localMatching ? "本地规则兜底 · AI 不可用" : "本地规则 · AI 不可用";
    }
    if (status === "no-result" || (state?.attempted && !state?.used && !state?.fallback)) {
      return localMatching ? "本地规则兜底 · AI 无匹配" : "本地规则 · AI 无可用匹配";
    }
    if (state?.used) {
      if (/填写匹配项/.test(stage)) {
        return "本地填写 · AI 不参与填写";
      }
      if (localMatching) {
        return "AI 优先匹配 · 本地整理结果";
      }
      return "AI 优先匹配 · 本地继续处理";
    }
    if (/读取本机资料|开始填写|扫描页面并准备填写/.test(stage)) {
      return "本地规则 · 正在读取资料";
    }
    if (/扫描当前页面/.test(stage)) {
      return "本地规则 · 正在扫描页面";
    }
    if (/整理表单字段/.test(stage)) {
      return "本地规则 · 正在整理字段";
    }
    if (localMatching) {
      return "正在用本地规则匹配";
    }
    if (/填写匹配项/.test(stage)) {
      return "本地填写 · 不自动提交";
    }
    return "本地规则 · 正在处理";
  }

  function getAutofillCompletionBadgeText(state = autofillAiState) {
    const status = state?.status || "idle";
    if (state?.used && state?.fallback) {
      return "AI 优先匹配 + 本地规则兜底";
    }
    if (state?.used) {
      return "AI 优先匹配 · 本地填写";
    }
    if (state?.fallback) {
      return "本地规则完成 · AI 不可用";
    }
    if (status === "no-result" || state?.attempted) {
      return "本地规则完成 · AI 无建议";
    }
    return "本地规则完成";
  }

  function sanitizeAutofillAiUsage(aiUsage = {}) {
    const fallbackReasons = Array.isArray(aiUsage.fallbackReasons)
      ? aiUsage.fallbackReasons.map(normalizeAutofillAiReason).filter((item) => item.phase || item.reason)
      : [];
    const usedPhases = Array.isArray(aiUsage.usedPhases)
      ? aiUsage.usedPhases.map((phase) => normalizeText(phase || "", 60)).filter(Boolean)
      : [];
    const notes = Array.isArray(aiUsage.notes)
      ? aiUsage.notes.map((note) => normalizeText(note || "", 160)).filter(Boolean)
      : [];
    const state = {
      status: normalizeText(aiUsage.status || "idle", 40),
      attempted: Boolean(aiUsage.attempted),
      used: Boolean(aiUsage.used),
      fallback: Boolean(aiUsage.fallback),
      currentPhase: normalizeText(aiUsage.currentPhase || "", 60),
      usedPhases,
      fallbackReasons,
      notes
    };
    const fallbackReason = normalizeText(aiUsage.fallbackReason || formatAutofillAiFallbackReasons(state), 260);
    return {
      ...state,
      fallbackReason,
      message: normalizeText(aiUsage.message || getAutofillAiStatusText(state), 300)
    };
  }

  function getAutofillAiSnapshot() {
    return sanitizeAutofillAiUsage(autofillAiState);
  }

  function getDisplayedProgressPercent() {
    if (!autofillProgress.active) {
      return 0;
    }
    const startedAt = Number(autofillProgress.startedAt || autofillProgress.stageStartedAt || Date.now());
    const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000);
    const eased = 1 - Math.exp(-elapsedSeconds / 75);
    return Math.min(96, normalizeProgressPercent(eased * 96));
  }

  function getAutofillProgressTitle() {
    if (!autofillProgress.active) {
      return "";
    }
    const label = autofillProgress.stepLabel || autofillProgress.stage || "处理当前页面";
    return /^正在/.test(label) ? label : `正在${label}`;
  }

  function getAutofillProgressDetail() {
    if (!autofillProgress.active) {
      return "";
    }
    const detail = autofillProgress.detail || "正在处理当前网页，请勿重复点击。";
    const elapsed = formatElapsedTime(autofillProgress.stageStartedAt);
    const isAiTrying = autofillAiState.status === "trying";
    if (isAiTrying && elapsed) {
      return `${detail}，正在等待 API 响应，已等待 ${elapsed}`;
    }
    if (elapsed) {
      return `${detail}，已处理 ${elapsed}`;
    }
    return detail;
  }

  function startAutofillRun(stage = "处理中") {
    if (autofillInProgress) {
      return 0;
    }

    autofillInProgress = true;
    autofillRunId += 1;
    autofillSummary = null;
    lastAutofillDebug = null;
    resetAutofillAiState();
    setAutofillProgress(stage, 4, "准备开始", true);
    return autofillRunId;
  }

  function isCurrentAutofillRun(runId) {
    return Boolean(autofillInProgress && runId && runId === autofillRunId);
  }

  function getAutofillRuntimeState() {
    return {
      profilePanelVisible,
      profilePanelCollapsed,
      sidebarFilter,
      activeProfileCategory,
      autofillInProgress,
      autofillProgress: { ...autofillProgress },
      autofillSummary: autofillSummary ? { ...autofillSummary } : null,
      autofillAi: getAutofillAiSnapshot(),
      learningCount: learningRecords.length,
      learningBaselineReady: Boolean(learningBaseline)
    };
  }

  function getAutofillDebugSnapshot() {
    return lastAutofillDebug
      ? {
          ...lastAutofillDebug,
          exportedAt: new Date().toISOString()
        }
      : null;
  }

  function getProfilePanelStateSnapshot() {
    return {
      profilePanelVisible,
      profilePanelCollapsed,
      sidebarFilter,
      activeProfileCategory
    };
  }

  function queueProfilePanelStateSave() {
    scheduleProfilePanelStateSave(getProfilePanelStateSnapshot());
  }

  function renderAndSaveProfilePanel(statusMessage = "", isError = false) {
    renderProfilePanel();
    if (statusMessage) {
      setProfilePanelStatus(statusMessage, isError);
    }
    queueProfilePanelStateSave();
  }

  function goProfilePanelHome() {
    activeProfileCategory = "";
    sidebarFilter = "";
    renderAndSaveProfilePanel("已返回主页。");
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime?.sendMessage) {
        reject(new Error("Extension runtime unavailable."));
        return;
      }

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

  function scheduleProfilePanelStateSave(patch = {}) {
    if (profilePanelStateSaveTimer) {
      clearTimeout(profilePanelStateSaveTimer);
    }

    profilePanelStateSaveTimer = setTimeout(() => {
      profilePanelStateSaveTimer = null;
      void persistProfilePanelState(patch);
    }, PROFILE_PANEL_STATE_DEBOUNCE_MS);
  }

  async function persistProfilePanelState(patch = {}) {
    try {
      await sendRuntimeMessage({
        type: "OJAF_SAVE_PROFILE_PANEL_STATE",
        payload: {
          pageKey: getPageKey(),
          patch
        }
      });
    } catch {
      // Session state is an enhancement only; continue without persistence.
    }
  }

  async function restoreProfilePanelState() {
    if (profilePanelStateRestored) {
      return;
    }
    profilePanelStateRestored = true;

    try {
      const state = await sendRuntimeMessage({
        type: "OJAF_GET_PROFILE_PANEL_STATE",
        payload: {
          pageKey: getPageKey()
        }
      });

      if (!state) {
        return;
      }

      profilePanelVisible = Boolean(state.profilePanelVisible);
      profilePanelCollapsed = Boolean(state.profilePanelCollapsed);
      sidebarFilter = normalizeText(state.sidebarFilter || "", 80);
      activeProfileCategory = normalizeText(state.activeProfileCategory || "", 80);

      if (profilePanelVisible) {
        const panel = ensureProfilePanel();
        panel.setAttribute(PANEL_HIDDEN_ATTR, "false");
        panel.setAttribute(PANEL_COLLAPSED_ATTR, profilePanelCollapsed ? "true" : "false");
        renderProfilePanel();
      }
    } catch {
      // No persisted state available.
    }
  }

  function compactText(value) {
    return normalizeText(value, 900)
      .replace(/[\s|*＊:：,，.。;；()（）[\]【】<>《》"'“”‘’/\\-]/g, "")
      .toLowerCase();
  }

  function textMatchScore(source, target) {
    const sourceText = compactText(source);
    const targetText = compactText(target);

    if (!sourceText || !targetText) {
      return 0;
    }

    if (sourceText === targetText) {
      return 5;
    }

    if (sourceText.includes(targetText) || targetText.includes(sourceText)) {
      return 4;
    }

    const sourceTokens = new Set(
      normalizeText(source, 900)
        .toLowerCase()
        .split(/[\s|*＊:：,，.。;；()（）[\]【】<>《》"'“”‘’/\\-]+/)
        .filter((token) => token.length > 1)
    );
    const targetTokens = normalizeText(target, 900)
      .toLowerCase()
      .split(/[\s|*＊:：,，.。;；()（）[\]【】<>《》"'“”‘’/\\-]+/)
      .filter((token) => token.length > 1);

    let overlap = 0;
    for (const token of targetTokens) {
      if (sourceTokens.has(token)) {
        overlap += 1;
      }
    }

    return Math.min(3, overlap);
  }

  function getButtonText(element) {
    if (!element) {
      return "";
    }

    return normalizeText(
      element.innerText ||
        element.textContent ||
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.getAttribute("value") ||
        ""
    );
  }

  function isActionControl(element, labels) {
    if (!element || !(element instanceof Element) || !isVisible(element)) {
      return false;
    }

    if (element.disabled || element.getAttribute("aria-disabled") === "true") {
      return false;
    }

    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const isClickable =
      tagName === "button" ||
      role === "button" ||
      (element instanceof HTMLInputElement && ["button", "submit"].includes(element.type));

    if (!isClickable) {
      return false;
    }

    const text = getButtonText(element);
    return labels.some((label) => text === label || text.includes(label));
  }

  function clickActionElement(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    element.scrollIntoView({ block: "center", inline: "nearest" });
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    element.click();
    return true;
  }

  function getOrCreateFieldId(element) {
    let fieldId = element.getAttribute(FIELD_ATTR);
    if (!fieldId) {
      fieldCounter += 1;
      fieldId = `arf_${Date.now().toString(36)}_${fieldCounter}`;
      element.setAttribute(FIELD_ATTR, fieldId);
    }
    return fieldId;
  }

  function getElementText(element) {
    if (!element) {
      return "";
    }
    return normalizeText(element.innerText || element.textContent || "");
  }

  function getTextWithoutControls(element) {
    if (!element) {
      return "";
    }

    const clone = element.cloneNode(true);
    clone.querySelectorAll("input, textarea, select, button, script, style, svg").forEach((node) => {
      node.remove();
    });
    return normalizeText(clone.innerText || clone.textContent || "");
  }

  function getLabelByFor(element) {
    if (!element.id) {
      return "";
    }

    const escapedId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(element.id) : element.id;
    const label = document.querySelector(`label[for="${escapedId}"]`);
    return getElementText(label);
  }

  function getAriaLabelText(element) {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      return normalizeText(ariaLabel);
    }

    const labelledBy = element.getAttribute("aria-labelledby");
    if (!labelledBy) {
      return "";
    }

    return normalizeText(
      labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map(getElementText)
        .join(" ")
    );
  }

  function getClosestDataAttributeValue(element, attributeNames, maxDepth = 6) {
    let current = element;
    for (let depth = 0; current && depth <= maxDepth; depth += 1, current = current.parentElement) {
      if (!(current instanceof Element)) {
        continue;
      }
      for (const name of attributeNames) {
        const value = current.getAttribute(name);
        if (value) {
          const normalized = normalizeText(value, 140);
          if (normalized) {
            return normalized;
          }
        }
      }
    }
    return "";
  }

  function getDataAttributeLabelText(element) {
    return normalizeFieldLabelText(
      getClosestDataAttributeValue(element, [
        "data-form-field-i18n-name",
        "data-form-field-name",
        "data-field-label",
        "data-label",
        "data-title"
      ])
    );
  }

  function getDataAttributeSectionText(element) {
    const direct = getClosestDataAttributeValue(element, [
      "data-section-title",
      "data-module-title",
      "data-group-title"
    ], 10);
    if (direct) {
      return direct;
    }

    let current = element.parentElement;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
      if (!(current instanceof Element)) {
        continue;
      }
      const scoped = current.querySelector(
        ".applyFormModuleWrapper-text,[data-section-title],[data-module-title],[class*='module-title'],[class*='section-title']"
      );
      const text = normalizeText(scoped?.textContent || "", 140);
      if (text) {
        return text;
      }
    }
    return "";
  }

  function getWrappingLabel(element) {
    const label = element.closest("label");
    return getTextWithoutControls(label);
  }

  function findFieldContainer(element) {
    const adapterSelectors = getAdapterSelectors();
    if (adapterSelectors.containerSelector) {
      const container = element.closest(adapterSelectors.containerSelector);
      if (container) {
        return container;
      }
    }

    let current = element.parentElement;
    let best = null;

    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      const text = getTextWithoutControls(current);
      const className = String(current.className || "");
      const likelyField =
        /form|field|item|row|cell|control|input|el-form-item|ant-form-item/i.test(className) ||
        current.querySelector("label") ||
        /[:：*]/.test(text);

      if (likelyField && text && text.length <= 180) {
        best = current;
        break;
      }

      if (!best && text && text.length <= 120) {
        best = current;
      }
    }

    return best || element.parentElement;
  }

  function getNearbyText(element) {
    const parts = [];
    const container = findFieldContainer(element);

    parts.push(getLabelByFor(element));
    parts.push(getWrappingLabel(element));
    parts.push(getAriaLabelText(element));
    parts.push(getDataAttributeLabelText(element));
    parts.push(getAdapterLabelText(element));
    parts.push(getDataAttributeSectionText(element));

    if (container) {
      parts.push(getTextWithoutControls(container));

      let previous = container.previousElementSibling;
      for (let i = 0; previous && i < 3; i += 1, previous = previous.previousElementSibling) {
        const text = getElementText(previous);
        if (text && text.length <= 120) {
          parts.push(text);
          break;
        }
      }
    }

    parts.push(element.getAttribute("placeholder"));
    parts.push(element.getAttribute("name"));
    parts.push(element.getAttribute("id"));
    parts.push(element.getAttribute("title"));

    return normalizeText([...new Set(parts.filter(Boolean))].join(" | "), 420);
  }

  function getFieldOptionLabelsText(field, maxLength = 180) {
    const options = Array.isArray(field?.options) ? field.options : [];
    const labels = options
      .map((option) => normalizeText(option?.label || option?.value || "", 40))
      .filter(Boolean);
    return normalizeText([...new Set(labels)].join(" | "), maxLength);
  }

  function normalizeFieldLabelText(value, maxLength = 90) {
    return normalizeText(value, maxLength)
      .replace(/^[*＊•\s]+/, "")
      .replace(/[:：]\s*$/, "")
      .replace(/^(请输入|请选择|请填写|请写明|点击选择)\s*/, "")
      .replace(/\s*(请输入|请选择|点击选择|选择)$/, "")
      .trim();
  }

  function isOptionOnlyLabel(value) {
    const text = normalizeText(value, 120);
    const key = compactText(text);
    if (!key) {
      return false;
    }
    if (/^(男|女|男女|是|否|是否|否是|有|无|有无|未参加|参加过|至今|填写结束时间|长期有效|填写有效期)$/i.test(key)) {
      return true;
    }
    return (
      key.length <= 80 &&
      (
        /^(离婚|离异|丧偶|已婚|未婚){2,}$/.test(key) ||
        /^(博士研究生|硕士研究生|大学本科|大学专科|中等专科|职业高中|技工学校|普通高中|其他|无){2,}$/.test(key) ||
        /^(博士|硕士|学士|其他|无){2,}$/.test(key) ||
        /^(A型|B型|AB型|O型|其他){2,}$/i.test(key) ||
        /^(全日制|非全日制|无数据){1,3}$/.test(key)
      )
    );
  }

  function isGenericFieldLabel(value) {
    const text = normalizeFieldLabelText(value, 80);
    return !text || /^(请输入|请选择|请填写|选择|内容列表|分数|总分数|日期|时间)$/i.test(text);
  }

  function extractFieldContainerLabel(container) {
    if (!container) {
      return "";
    }

    const text = getTextWithoutControls(container);
    if (!text) {
      return "";
    }

    const requiredMatches = Array.from(text.matchAll(/[*＊]\s*([^:：\n]{1,70})\s*[:：]/g));
    if (requiredMatches.length > 0) {
      return normalizeFieldLabelText(requiredMatches[0][1]);
    }

    const matches = Array.from(text.matchAll(/([^:：\n]{1,70})\s*[:：]/g));
    if (matches.length > 0) {
      return normalizeFieldLabelText(matches[0][1]);
    }

    return normalizeFieldLabelText(text.split(/\s{2,}|\|/)[0], 90);
  }

  function getPlaceholderDerivedLabel(placeholder, containerText = "") {
    const text = normalizeText(placeholder, 100);
    const context = compactText(containerText);
    if (!text) {
      return "";
    }

    if (/GPA|平均学分成绩/i.test(text)) {
      return "GPA分数";
    }
    if (/没有班级排名/.test(text)) {
      return "无班级排名原因";
    }
    if (/没有专业排名/.test(text)) {
      return "无专业排名原因";
    }
    if (/其他行业属性/.test(text)) {
      return "其他行业属性";
    }
    if (/工作内容描述/.test(text)) {
      return "工作内容描述";
    }
    if (/受到奖励|学术成果/.test(text)) {
      return "受到奖励/学术成果";
    }
    if (/社会\/?校园活动/.test(text)) {
      return "社会/校园活动";
    }
    if (/爱好|专长/.test(text)) {
      return "爱好及专长";
    }
    if (/自我评价/.test(text)) {
      return "自我评价";
    }
    if (/总分数/.test(text)) {
      return "高考总分";
    }
    if (/分数/.test(text) && /六级/.test(context)) {
      return "六级分数";
    }
    if (/分数/.test(text) && /四级/.test(context)) {
      return "四级分数";
    }
    if (/分数/.test(text) && /托福|toefl/i.test(context)) {
      return "TOEFL分数";
    }
    if (/分数/.test(text) && /雅思|ielts/i.test(context)) {
      return "IELTS分数";
    }
    if (/分数/.test(text) && /gre/i.test(context)) {
      return "GRE分数";
    }
    if (/分数/.test(text) && /gmat/i.test(context)) {
      return "GMAT分数";
    }
    if (/分数/.test(text)) {
      return "考试分数";
    }

    const cleaned = normalizeFieldLabelText(text);
    return /^(日期|时间|请输入|请选择|请填写)$/.test(cleaned) ? "" : cleaned;
  }

  function getGroupedControlInfo(container, element) {
    if (!container) {
      return { controls: [], index: -1 };
    }

    const controls = Array.from(container.querySelectorAll(CONTROL_SELECTOR))
      .filter((item, index, array) => array.indexOf(item) === index)
      .filter((item) => !item.closest(`#${PANEL_ID}`))
      .filter(isVisible);

    const index = controls.findIndex((item) => item === element || item.contains(element) || element.contains(item));
    return { controls, index };
  }

  function getRepeatGroupLabelText(element) {
    const root = findRepeatItemRoot(element);
    if (!root) {
      return "";
    }

    const controls = Array.from(root.querySelectorAll(CONTROL_SELECTOR))
      .filter((item, index, array) => array.indexOf(item) === index)
      .filter((item) => !item.closest(`#${PANEL_ID}`))
      .filter(isVisible);
    const labels = controls
      .map(getControlContextLabel)
      .filter((label) => label && !isOptionOnlyLabel(label) && !/OpenJobAutofill/.test(label));

    return normalizeText([...new Set(labels)].join(" | "), 360);
  }

  function getControlContextLabel(control) {
    const container = findFieldContainer(control);
    return normalizeFieldLabelText(
      extractFieldContainerLabel(container) ||
        getDataAttributeLabelText(control) ||
        getAdapterLabelText(control) ||
        getLabelByFor(control) ||
        getWrappingLabel(control) ||
        getAriaLabelText(control) ||
        ""
    );
  }

  function isRepeatItemRootCandidate(root) {
    if (!root || root.closest?.(`#${PANEL_ID}`)) {
      return false;
    }

    const controls = Array.from(root.querySelectorAll?.(CONTROL_SELECTOR) || []).filter(isVisible);
    if (controls.length < 2 || controls.length > 24) {
      return false;
    }

    const text = getTextWithoutControls(root);
    return Boolean(text && text.length <= 2600);
  }

  function getLocationGroupedLabel(context, index) {
    if (index < 0) {
      return "";
    }

    const suffixes = ["省", "市", "区县"];
    const suffix = suffixes[index] || `第${index + 1}项`;
    const groups = [
      [/工作\/实习地点|工作实习地点|实习地点|工作地点/, "工作/实习地点"],
      [/现户口所在地|当前户口所在地|户口所在地/, "现户口所在地"],
      [/生源地/, "生源地"],
      [/籍贯/, "籍贯"],
      [/高考所在地|高考省份/, "高考所在地"]
    ];

    for (const [pattern, label] of groups) {
      if (pattern.test(context)) {
        return `${label}${suffix}`;
      }
    }

    return "";
  }

  function disambiguateGroupedFieldLabel(element, label, container, placeholder) {
    const containerText = getTextWithoutControls(container);
    const context = compactText([label, containerText, placeholder].join(" "));
    const { controls, index } = getGroupedControlInfo(container, element);
    const type = getControlType(element);

    if (controls.length >= 2) {
      const locationLabel = getLocationGroupedLabel(context, index);
      if (locationLabel) {
        return locationLabel;
      }
    }

    if (/平均学分成绩gpa/.test(context)) {
      if (/分数|数字/.test(compactText(placeholder)) || element instanceof HTMLInputElement) {
        return "GPA分数";
      }
      if (type === "combobox" || type === "select") {
        return "GPA满分";
      }
      return "平均学分成绩（GPA）";
    }

    if (/有无班级排名/.test(context)) {
      if (/原因/.test(context) || element instanceof HTMLInputElement) {
        return "无班级排名原因";
      }
      if (type === "combobox" || type === "select") {
        return "班级排名";
      }
      return "有无班级排名";
    }

    if (/有无专业排名/.test(context)) {
      if (/原因/.test(context) || element instanceof HTMLInputElement) {
        return "无专业排名原因";
      }
      if (type === "combobox" || type === "select") {
        return "专业排名";
      }
      return "有无专业排名";
    }

    if (/本段经历升学类型/.test(context)) {
      if (/总分/.test(context)) {
        return "高考总分";
      }
      if (/分数/.test(context) && (type === "number" || type === "text")) {
        return "考试分数";
      }
      return "本段经历升学类型";
    }

    if (/竞赛/.test(context)) {
      if (/项目/.test(context)) {
        return "竞赛项目";
      }
      if (/奖项/.test(context)) {
        return "竞赛奖项";
      }
      if (/时间|日期/.test(context)) {
        return "竞赛时间";
      }
    }

    for (const test of [
      ["六级", "六级"],
      ["四级", "四级"],
      ["toefl", "TOEFL"],
      ["ielts", "IELTS"],
      ["gre", "GRE"],
      ["gmat", "GMAT"]
    ]) {
      const [needle, title] = test;
      if (context.includes(needle)) {
        if (/分数/.test(context)) {
          return `${title}分数`;
        }
        if (/获得时间|取得时间/.test(context)) {
          return `${title}获得时间`;
        }
        if (/有效期/.test(context)) {
          return `${title}有效期`;
        }
        return title;
      }
    }

    return label;
  }

  function extractContextualLabelFromText(text) {
    const source = normalizeText(text, 500);
    if (!source) {
      return "";
    }

    const parts = source.split(/\s*\|\s*/).map((part) => normalizeText(part, 140)).filter(Boolean);
    for (const part of parts) {
      const match = part.match(/(?:^|[\s*＊])([^:：]{1,70})[:：]/);
      const label = normalizeFieldLabelText(match ? match[1] : part);
      if (
        label &&
        !isGenericFieldLabel(label) &&
        !isOptionOnlyLabel(label) &&
        !/^\d+\/\d+$/.test(label) &&
        !/请上传|请选择|请输入|无数据/.test(label)
      ) {
        return label;
      }
    }

    return "";
  }

  function improveFieldLabel(element, rawLabel, nearbyText) {
    const container = findFieldContainer(element);
    const containerLabel = extractFieldContainerLabel(container);
    const contextLabel = extractContextualLabelFromText(nearbyText);
    const placeholder = normalizeText(element.getAttribute("placeholder"), 100);
    const placeholderLabel = getPlaceholderDerivedLabel(placeholder, getTextWithoutControls(container));
    const raw = normalizeFieldLabelText(rawLabel);
    let label = raw;

    if (isGenericFieldLabel(label) || isOptionOnlyLabel(label)) {
      label = contextLabel || containerLabel || label;
    }

    if (placeholderLabel && (isGenericFieldLabel(label) || /原因|分数|行业属性|工作内容|奖励|活动|评价|专长/.test(placeholderLabel))) {
      label = placeholderLabel;
    }

    if (isGenericFieldLabel(label) || isOptionOnlyLabel(label)) {
      label = contextLabel || normalizeFieldLabelText(nearbyText.split(/\s*\|\s*/)[0]);
    }

    return disambiguateGroupedFieldLabel(element, normalizeFieldLabelText(label), container, placeholder);
  }

  function getAdapterLabelText(element) {
    const { labelSelector } = getAdapterSelectors();
    const container = findFieldContainer(element);
    if (!container || !labelSelector) {
      return "";
    }

    try {
      const labels = Array.from(container.querySelectorAll(labelSelector))
        .slice(0, 4)
        .map((label) => getElementText(label))
        .filter(Boolean);
      return normalizeText(labels.join(" | "), 160);
    } catch {
      return "";
    }
  }

  function getSectionText(element) {
    const parts = [];
    const elementRect = element.getBoundingClientRect();
    const adapterSelectors = getAdapterSelectors();
    const headingSelector = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "legend",
      "[role='heading']",
      ".title",
      ".section-title",
      ".card-title",
      adapterSelectors.sectionSelector
    ]
      .filter(Boolean)
      .join(",");

    const pushText = (text) => {
      const normalized = normalizeSectionHeadingText(text);
      if (normalized) {
        parts.push(normalized);
        return;
      }
      const plain = normalizeText(text, 180);
      if (plain && plain.length <= 180 && /[\u4e00-\u9fa5A-Za-z]/.test(plain)) {
        parts.push(plain);
      }
    };

    pushText(getDataAttributeSectionText(element));

    let current = element.parentElement;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
      const headingText = getNearestScopedHeadingText(current, headingSelector, element, elementRect);
      if (headingText) {
        pushText(headingText);
      }

      let previous = current.previousElementSibling;
      for (let i = 0; previous && i < 8; i += 1, previous = previous.previousElementSibling) {
        const text = getElementText(previous);
        if (text && /[\u4e00-\u9fa5A-Za-z]/.test(text)) {
          pushText(text);
          break;
        }
      }
    }

    return normalizeText([...new Set(parts)].join(" | "), 240);
  }

  function getNearestScopedHeadingText(root, headingSelector, element, elementRect) {
    if (!root?.querySelectorAll || !headingSelector) {
      return "";
    }

    let best = null;
    let bestBottom = -Infinity;
    for (const heading of Array.from(root.querySelectorAll(headingSelector))) {
      if (!(heading instanceof Element) || heading.contains(element)) {
        continue;
      }
      const rect = heading.getBoundingClientRect();
      if (rect.bottom > elementRect.top + 8 || rect.bottom < bestBottom) {
        continue;
      }
      const text = getElementText(heading);
      if (!text || text.length > 260) {
        continue;
      }
      best = text;
      bestBottom = rect.bottom;
    }
    return best || "";
  }

  function normalizeSectionHeadingText(text) {
    const key = compactText(text);
    if (!key) {
      return "";
    }

    const sections = [
      ["基本信息", /基本信息|个人信息/],
      ["教育经历", /教育经历|教育背景/],
      ["工作经历", /工作经历/],
      ["绩效考核", /近三年年度绩效考核|绩效考核/],
      ["家庭信息", /家庭及社会关系|家庭情况|家庭信息|社会关系/],
      ["证书技能", /证书信息|证书技能|资格证书/],
      ["专业资格", /专业技术资格|职业资格|职称/],
      ["奖惩情况", /奖惩信息|奖惩情况/],
      ["自我描述", /自我评价及相关情况说明|自我评价|自我描述/],
      ["有关声明", /有关声明/]
    ];

    for (const [label, pattern] of sections) {
      if (pattern.test(key)) {
        return label;
      }
    }

    return "";
  }

  function getOptions(element) {
    if (element instanceof HTMLSelectElement) {
      return Array.from(element.options).map((option) => ({
        value: option.value,
        label: normalizeText(option.textContent)
      }));
    }

    const ariaControls = element.getAttribute("aria-controls");
    const optionRoot = ariaControls ? document.getElementById(ariaControls) : getExpandedOptionRoot(element);
    if (!optionRoot) {
      return [];
    }

    return Array.from(optionRoot.querySelectorAll('[role="option"], li, .option'))
      .slice(0, 80)
      .map((option) => ({
        value: option.getAttribute("data-value") || getElementText(option),
        label: getElementText(option)
      }))
      .filter((option) => option.label || option.value);
  }

  function getExpandedOptionRoot(element) {
    if (!element) {
      return null;
    }

    const ariaExpanded = element.getAttribute("aria-expanded");
    if (ariaExpanded === "true") {
      const popupId = element.getAttribute("aria-controls") || element.getAttribute("aria-owns");
      if (popupId) {
        const controlled = document.getElementById(popupId);
        if (controlled) {
          return controlled;
        }
      }
    }

    const closestPopup = element.closest('[role="combobox"],[class*="select"],[class*="picker"]');
    if (closestPopup) {
      const popup = closestPopup.querySelector('[role="listbox"],[role="menu"],[class*="dropdown"],[class*="option"]');
      if (popup) {
        return popup;
      }
    }

    return null;
  }

  function getControlType(element) {
    if (element instanceof HTMLTextAreaElement) {
      return "textarea";
    }

    if (element instanceof HTMLSelectElement) {
      return "select";
    }

    if (element.isContentEditable) {
      return "contenteditable";
    }

    const role = element.getAttribute("role");
    if (role === "combobox") {
      return "combobox";
    }
    if (role === "radio") {
      return "radio";
    }
    if (role === "checkbox") {
      return "checkbox";
    }

    if (element instanceof HTMLInputElement) {
      return element.type || "text";
    }

    return role || "text";
  }

  function getControlCurrentValue(element) {
    if (!element) {
      return "";
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) {
        return element.checked ? "checked" : "";
      }
      return normalizeText(element.value || "", 260);
    }

    if (element.isContentEditable) {
      return normalizeText(element.textContent || "", 260);
    }

    return "";
  }

  function hasMeaningfulControlValue(element, label, currentValue) {
    const value = normalizeText(currentValue, 120);
    if (!value || /^(请选择|请先选择|无数据|undefined|null)$/i.test(value)) {
      return false;
    }

    const labelKey = normalizeMatchKey(label);
    if (
      element instanceof HTMLInputElement &&
      (element.type === "number" || element.getAttribute("role") === "spinbutton") &&
      /^(0|1|0\.0+|1\.0+)$/.test(value) &&
      /身高|体重|收入|薪资|年薪/.test(labelKey)
    ) {
      return false;
    }

    return true;
  }

  function buildFieldMeta(element) {
    const adapter = getActiveSiteAdapter();
    const type = getControlType(element);
    const canFill = !element.disabled && type !== "file";
    const rawLabel = normalizeText(
      getLabelByFor(element) ||
        getDataAttributeLabelText(element) ||
        getAdapterLabelText(element) ||
        getWrappingLabel(element) ||
        getAriaLabelText(element)
    );
    const nearbyText = getNearbyText(element);
    const label = improveFieldLabel(element, rawLabel, nearbyText);
    const currentValue = getControlCurrentValue(element);
    const groupText = getRepeatGroupLabelText(element);

    return {
      fieldId: getOrCreateFieldId(element),
      type,
      tagName: element.tagName.toLowerCase(),
      label,
      placeholder: normalizeText(element.getAttribute("placeholder")),
      name: normalizeText(element.getAttribute("name")),
      id: normalizeText(element.getAttribute("id")),
      required: Boolean(element.required || element.getAttribute("aria-required") === "true"),
      disabled: Boolean(element.disabled),
      readOnly: Boolean(element.readOnly || element.getAttribute("aria-readonly") === "true"),
      hasCurrentValue: hasMeaningfulControlValue(element, label, currentValue),
      currentValue,
      canFill,
      section: getSectionText(element),
      nearbyText,
      groupText,
      options: getOptions(element),
      cssPath: getCssPath(element),
      siteAdapterId: adapter?.id || "",
      siteAdapterName: adapter?.name || ""
    };
  }

  function getCssPath(element) {
    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      let selector = current.nodeName.toLowerCase();
      if (current.id) {
        selector += `#${current.id}`;
        parts.unshift(selector);
        break;
      }

      const className = String(current.className || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join(".");
      if (className) {
        selector += `.${className}`;
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(" > ");
  }

  function collectVisibleControls(root = document) {
    return Array.from(root.querySelectorAll(CONTROL_SELECTOR))
      .filter((element, index, array) => array.indexOf(element) === index)
      .filter((element) => !element.closest(`#${PANEL_ID}`))
      .filter(isVisible);
  }

  function hasVisibleControls(root) {
    return collectVisibleControls(root).length > 0;
  }

  function looksLikeEditableSummary(text) {
    return Boolean(text && text.length >= 8 && text.length <= 1400 && /[:：]/.test(text));
  }

  function findActionRoot(actionElement) {
    let current = actionElement?.parentElement || null;
    let best = current;

    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const text = getTextWithoutControls(current);
      if (text && text.length <= 1400) {
        best = current;
        if (looksLikeEditableSummary(text)) {
          return current;
        }
      }
    }

    return best || actionElement?.parentElement || null;
  }

  function findNextClosedEditButton() {
    const buttons = Array.from(
      document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')
    );
    const editLabels = getAdapterActionLabels("edit");

    return (
      buttons.find((button) => {
        if (
          !isActionControl(button, editLabels) ||
          button.getAttribute(EDIT_ATTEMPT_ATTR) === "true"
        ) {
          return false;
        }

        const root = findActionRoot(button);
        if (!root) {
          return false;
        }

        const text = getTextWithoutControls(root);
        return looksLikeEditableSummary(text) && !hasVisibleControls(root);
      }) || null
    );
  }

  async function expandEditableCardsForScan() {
    let expanded = 0;

    for (let i = 0; i < MAX_EDIT_EXPANSIONS; i += 1) {
      const button = findNextClosedEditButton();
      if (!button) {
        break;
      }

      button.setAttribute(EDIT_ATTEMPT_ATTR, "true");
      clickActionElement(button);
      expanded += 1;
      await sleep(180);
    }

    return expanded;
  }

  async function scanForm() {
    currentSiteAdapter = detectSiteAdapter();
    const expandedEditCards = await expandEditableCardsForScan();
    const controls = collectVisibleControls();

    const fields = controls.map((element) => buildFieldMeta(element));
    const adapter = getActiveSiteAdapter();

    return {
      url: location.href,
      hostname: location.hostname,
      title: document.title,
      siteAdapter: adapter
        ? {
            id: adapter.id || "",
            name: adapter.name || "",
            confidence: adapter.confidence || 0
          }
        : null,
      scannedAt: new Date().toISOString(),
      expandedEditCards,
      fields
    };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [${MARK_ATTR}="filled"] {
        outline: 2px solid #19a974 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(25, 169, 116, 0.14) !important;
      }
      [${MARK_ATTR}="uncertain"] {
        outline: 2px solid #f5a623 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(245, 166, 35, 0.18) !important;
      }
      [${MARK_ATTR}="error"] {
        outline: 2px solid #f5a623 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(245, 166, 35, 0.18) !important;
      }
      [${MARK_ATTR}="missing"] {
        outline: 2px dashed #d9822b !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(217, 130, 43, 0.12) !important;
      }
      #${FLOAT_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        width: min(360px, calc(100vw - 36px));
        padding: 14px;
        border: 1px solid rgba(38, 58, 44, 0.14);
        border-radius: 18px;
        background:
          linear-gradient(180deg, rgba(255, 253, 247, 0.98), rgba(249, 244, 234, 0.96)),
          radial-gradient(circle at 0% 0%, rgba(15, 107, 79, 0.13), transparent 42%);
        box-shadow: 0 18px 58px rgba(32, 33, 36, 0.18);
        z-index: 2147483645;
        color: #202124;
        font: 13px/1.45 ui-serif, Georgia, "Times New Roman", "Noto Serif SC", serif;
      }
      #${FLOAT_ID}[hidden] {
        display: none;
      }
      #${FLOAT_ID} * {
        box-sizing: border-box;
      }
      #${FLOAT_ID} .arf-float-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      #${FLOAT_ID} .arf-float-title {
        color: #26231e;
        font-size: 15px;
        font-weight: 700;
      }
      #${FLOAT_ID} .arf-float-detail {
        margin-top: 3px;
        color: #6f6a60;
        font-size: 12px;
      }
      #${FLOAT_ID} .arf-float-privacy {
        margin-top: 8px;
        padding: 8px 10px;
        border: 1px solid rgba(15, 107, 79, 0.14);
        border-radius: 12px;
        background: rgba(15, 107, 79, 0.07);
        color: #4d6458;
        font-size: 11px;
        line-height: 1.45;
      }
      #${FLOAT_ID} .arf-float-ai {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(15, 107, 79, 0.12);
        color: #0f6b4f;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.3;
      }
      #${FLOAT_ID} .arf-float-close {
        width: 26px;
        min-width: 26px;
        height: 26px;
        border: 1px solid #ded6c8;
        border-radius: 9px;
        background: #fff;
        color: #4b463f;
        cursor: pointer;
      }
      #${FLOAT_ID} .arf-float-progress {
        margin-top: 11px;
      }
      #${FLOAT_ID} .arf-float-track {
        height: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(15, 107, 79, 0.12);
      }
      #${FLOAT_ID} .arf-float-fill {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #0f6b4f, #d48a1f);
        transition: width 0.25s ease;
      }
      #${FLOAT_ID} .arf-float-chips {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      #${FLOAT_ID} .arf-float-chip {
        padding: 8px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.74);
        color: #6f6a60;
        text-align: center;
      }
      #${FLOAT_ID} .arf-float-chip strong {
        display: block;
        color: #26231e;
        font-size: 18px;
        line-height: 1.1;
      }
      #${FLOAT_ID} .arf-float-chip.is-ok strong {
        color: #0f6b4f;
      }
      #${FLOAT_ID} .arf-float-chip.is-warn strong {
        color: #bf7a18;
      }
      #${FLOAT_ID} .arf-float-chip.is-missing {
        border: 1px dashed rgba(217, 130, 43, 0.7);
      }
      #${FLOAT_ID} .arf-float-chip.is-missing strong {
        color: #d9822b;
      }
      #${FLOAT_ID} .arf-float-chip.is-learn {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: 1px solid rgba(15, 107, 79, 0.35);
        background: rgba(15, 107, 79, 0.08);
        color: #0f6b4f;
        font: inherit;
        cursor: pointer;
      }
      #${FLOAT_ID} .arf-float-chip.is-learn strong {
        display: inline;
        color: #0f6b4f;
        font-size: 16px;
      }
      #${LEARNING_PANEL_ID} {
        position: fixed;
        top: 8px;
        right: 0;
        width: min(470px, calc(100vw - 28px));
        max-height: calc(100dvh - 16px);
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(38, 58, 44, 0.14);
        border-radius: 18px 0 0 18px;
        background: linear-gradient(180deg, rgba(255, 253, 247, 0.99), rgba(249, 244, 234, 0.98));
        box-shadow: 0 18px 58px rgba(32, 33, 36, 0.2);
        z-index: 2147483646;
        color: #202124;
        font: 13px/1.45 ui-serif, Georgia, "Times New Roman", "Noto Serif SC", serif;
      }
      #${LEARNING_PANEL_ID}[hidden] {
        display: none;
      }
      #${LEARNING_PANEL_ID} * {
        box-sizing: border-box;
      }
      #${LEARNING_PANEL_ID} .arf-learn-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 16px 10px;
        border-bottom: 1px solid rgba(38, 58, 44, 0.1);
      }
      #${LEARNING_PANEL_ID} .arf-learn-title {
        font-size: 16px;
        font-weight: 700;
        color: #26231e;
      }
      #${LEARNING_PANEL_ID} .arf-learn-sub {
        margin-top: 3px;
        font-size: 12px;
        color: #6f6a60;
      }
      #${LEARNING_PANEL_ID} .arf-learn-close {
        border: 0;
        background: transparent;
        color: #6f6a60;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
      }
      #${LEARNING_PANEL_ID} .arf-learn-list {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 8px 12px;
      }
      #${LEARNING_PANEL_ID} .arf-learn-group {
        margin: 10px 4px 6px;
        font-size: 12px;
        font-weight: 700;
        color: #6f6a60;
      }
      #${LEARNING_PANEL_ID} .arf-learn-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 8px;
        padding: 10px;
        margin-bottom: 8px;
        border: 1px solid rgba(38, 58, 44, 0.1);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.72);
      }
      #${LEARNING_PANEL_ID} .arf-learn-item.is-unready {
        border-style: dashed;
      }
      #${LEARNING_PANEL_ID} .arf-learn-item input[type="checkbox"] {
        margin-top: 3px;
        width: 15px;
        height: 15px;
      }
      #${LEARNING_PANEL_ID} .arf-learn-body {
        min-width: 0;
      }
      #${LEARNING_PANEL_ID} .arf-learn-line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }
      #${LEARNING_PANEL_ID} .arf-learn-badge {
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        background: rgba(15, 107, 79, 0.12);
        color: #0f6b4f;
      }
      #${LEARNING_PANEL_ID} .arf-learn-badge.is-add {
        background: rgba(31, 90, 160, 0.12);
        color: #1f5aa0;
      }
      #${LEARNING_PANEL_ID} .arf-learn-badge.is-alias {
        background: rgba(98, 71, 170, 0.12);
        color: #6247aa;
      }
      #${LEARNING_PANEL_ID} .arf-learn-hint {
        margin: 2px 0 4px;
        font-size: 12px;
        color: #6f6a60;
      }
      #${LEARNING_PANEL_ID} .arf-learn-badge.is-custom,
      #${LEARNING_PANEL_ID} .arf-learn-badge.is-unresolved {
        background: rgba(191, 122, 24, 0.14);
        color: #bf7a18;
      }
      #${LEARNING_PANEL_ID} .arf-learn-field {
        font-weight: 700;
        color: #26231e;
      }
      #${LEARNING_PANEL_ID} .arf-learn-page {
        font-size: 11px;
        color: #8a847a;
      }
      #${LEARNING_PANEL_ID} .arf-learn-target {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        color: #4b463e;
      }
      #${LEARNING_PANEL_ID} .arf-learn-target select {
        max-width: 100%;
        padding: 2px 6px;
        border: 1px solid rgba(38, 58, 44, 0.25);
        border-radius: 8px;
        background: #fffdf8;
        color: #26231e;
        font: inherit;
        font-size: 12px;
      }
      #${LEARNING_PANEL_ID} .arf-learn-values {
        margin-top: 4px;
        color: #4b463e;
        word-break: break-all;
      }
      #${LEARNING_PANEL_ID} .arf-learn-values s {
        color: #8a847a;
      }
      #${LEARNING_PANEL_ID} .arf-learn-values strong {
        color: #0f6b4f;
      }
      #${LEARNING_PANEL_ID} .arf-learn-ignore {
        align-self: start;
        border: 0;
        background: transparent;
        color: #8a847a;
        font-size: 16px;
        cursor: pointer;
      }
      #${LEARNING_PANEL_ID} .arf-learn-empty {
        padding: 24px 12px;
        text-align: center;
        color: #6f6a60;
      }
      #${LEARNING_PANEL_ID} .arf-learn-foot {
        padding: 10px 14px 14px;
        border-top: 1px solid rgba(38, 58, 44, 0.1);
      }
      #${LEARNING_PANEL_ID} .arf-learn-privacy {
        margin-bottom: 8px;
        font-size: 11px;
        color: #6f6a60;
      }
      #${LEARNING_PANEL_ID} .arf-learn-status {
        min-height: 1.3em;
        margin-bottom: 8px;
        font-size: 12px;
        color: #4b463e;
      }
      #${LEARNING_PANEL_ID} .arf-learn-status.is-error {
        color: #a94040;
        font-weight: 700;
      }
      #${LEARNING_PANEL_ID} .arf-learn-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      #${LEARNING_PANEL_ID} .arf-learn-actions button {
        flex: 1;
        min-height: 34px;
        border: 0;
        border-radius: 11px;
        background: #0f6b4f;
        color: #fff;
        font: inherit;
        cursor: pointer;
      }
      #${LEARNING_PANEL_ID} .arf-learn-actions button.secondary {
        border: 1px solid #0f6b4f;
        background: transparent;
        color: #0f6b4f;
      }
      #${LEARNING_PANEL_ID} .arf-learn-actions button.ghost {
        border: 1px solid rgba(38, 58, 44, 0.25);
        background: transparent;
        color: #6f6a60;
      }
      #${LEARNING_PANEL_ID} .arf-learn-actions button:disabled {
        opacity: 0.55;
        cursor: default;
      }
      #${FLOAT_ID} .arf-float-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      #${FLOAT_ID} .arf-float-actions button {
        flex: 1;
        min-height: 34px;
        border: 0;
        border-radius: 11px;
        background: #0f6b4f;
        color: #fff;
        cursor: pointer;
      }
      #${FLOAT_ID} .arf-float-actions button.secondary {
        border: 1px solid #0f6b4f;
        background: transparent;
        color: #0f6b4f;
      }
      #${PANEL_ID} {
        position: fixed;
        top: 8px;
        right: 0;
        width: min(430px, calc(100vw - 28px));
        height: calc(100dvh - 16px);
        max-height: calc(100dvh - 16px);
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px 16px max(18px, env(safe-area-inset-bottom));
        border: 0;
        border-left: 1px solid rgba(38, 58, 44, 0.16);
        border-radius: 18px 0 0 18px;
        background:
          linear-gradient(180deg, rgba(255, 253, 247, 0.99), rgba(250, 246, 236, 0.98)),
          radial-gradient(circle at 10% 0%, rgba(15, 107, 79, 0.1), transparent 32%);
        box-shadow: -18px 0 48px rgba(34, 34, 34, 0.16);
        z-index: 2147483646;
        font-size: 13px;
        color: #202124;
        overflow: hidden;
      }
      @supports not (height: 100dvh) {
        #${PANEL_ID} {
          height: calc(100vh - 16px);
          max-height: calc(100vh - 16px);
        }
      }
      #${PANEL_ID}[${PANEL_HIDDEN_ATTR}="true"] {
        display: none;
      }
      #${PANEL_ID}[${PANEL_COLLAPSED_ATTR}="true"] {
        top: calc(50vh - 76px);
        width: 46px;
        height: 152px;
        padding: 6px;
        border: 1px solid rgba(38, 58, 44, 0.16);
        border-right: 0;
        border-radius: 14px 0 0 14px;
      }
      #${PANEL_ID}[${PANEL_COLLAPSED_ATTR}="true"] .arf-body,
      #${PANEL_ID}[${PANEL_COLLAPSED_ATTR}="true"] .arf-footer,
      #${PANEL_ID}[${PANEL_COLLAPSED_ATTR}="true"] .arf-subtitle,
      #${PANEL_ID}[${PANEL_COLLAPSED_ATTR}="true"] .arf-home,
      #${PANEL_ID}[${PANEL_COLLAPSED_ATTR}="true"] .arf-close {
        display: none;
      }
      #${PANEL_ID}[${PANEL_COLLAPSED_ATTR}="true"] .arf-header {
        height: 100%;
        align-items: center;
        justify-content: center;
      }
      #${PANEL_ID}[${PANEL_COLLAPSED_ATTR}="true"] .arf-title {
        display: none;
      }
      #${PANEL_ID}[${PANEL_COLLAPSED_ATTR}="true"] .arf-toggle {
        width: 34px;
        height: 132px;
        min-height: 132px;
        padding: 0;
        writing-mode: vertical-rl;
        letter-spacing: 0.16em;
      }
      #${PANEL_ID} * {
        box-sizing: border-box;
      }
      #${PANEL_ID} .arf-body {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
        overflow-y: auto;
        padding: 0 3px 8px 0;
        overscroll-behavior: contain;
      }
      #${PANEL_ID} .arf-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }
      #${PANEL_ID} .arf-title {
        font-size: 18px;
        font-weight: 700;
      }
      #${PANEL_ID} .arf-subtitle {
        margin-top: 2px;
        color: #6f6a60;
        line-height: 1.45;
      }
      #${PANEL_ID} .arf-close {
        width: 28px;
        min-height: 28px;
        border: 1px solid #ded6c8;
        border-radius: 8px;
        background: #fff;
        color: #333;
      }
      #${PANEL_ID} .arf-home,
      #${PANEL_ID} .arf-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 28px;
        min-height: 28px;
        padding: 0;
        border: 1px solid #ded6c8;
        border-radius: 8px;
        background: #fff;
        color: #333;
        cursor: pointer;
      }
      #${PANEL_ID} .arf-header-actions {
        display: flex;
        flex: none;
        align-items: center;
        gap: 6px;
      }
      #${PANEL_ID} .arf-search {
        width: 100%;
        min-height: 40px;
        padding: 0 12px;
        border: 1px solid #ded6c8;
        border-radius: 13px;
        background: #fffdf8;
        color: #202124;
        font: inherit;
      }
      #${PANEL_ID} .arf-content {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #${PANEL_ID} .arf-overview {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
      }
      #${PANEL_ID} .arf-category-card {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        width: 100%;
        padding: 14px;
        border: 1px solid #e2d8c8;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.74);
        color: #202124;
        text-align: left;
        cursor: pointer;
      }
      #${PANEL_ID} .arf-category-card:hover {
        border-color: rgba(15, 107, 79, 0.35);
        background: #fffdf8;
      }
      #${PANEL_ID} .arf-category-title {
        font-size: 15px;
        font-weight: 700;
        color: #26231e;
      }
      #${PANEL_ID} .arf-category-note {
        margin-top: 5px;
        color: #7a7164;
        font-size: 12px;
        line-height: 1.45;
      }
      #${PANEL_ID} .arf-category-count {
        align-self: start;
        min-width: 34px;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(15, 107, 79, 0.12);
        color: #0f6b4f;
        font-size: 12px;
        font-weight: 700;
        text-align: center;
      }
      #${PANEL_ID} .arf-detail-head {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0 4px;
        background: linear-gradient(180deg, rgba(255, 253, 247, 0.99), rgba(255, 253, 247, 0.88));
      }
      #${PANEL_ID} .arf-back {
        min-height: 32px;
        padding: 0 11px;
        border: 1px solid #ded6c8;
        border-radius: 10px;
        background: #fff;
        color: #4b463f;
        cursor: pointer;
      }
      #${PANEL_ID} .arf-detail-title {
        font-size: 16px;
        font-weight: 700;
      }
      #${PANEL_ID} .arf-detail-card {
        padding: 14px;
        border: 1px solid #e2d8c8;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.78);
      }
      #${PANEL_ID} .arf-subsection-title {
        margin: 2px 0 10px;
        color: #0f6b4f;
        font-size: 13px;
        font-weight: 700;
      }
      #${PANEL_ID} .arf-readable {
        user-select: text;
        -webkit-user-select: text;
      }
      #${PANEL_ID} .arf-row {
        display: grid;
        grid-template-columns: minmax(84px, 0.38fr) minmax(0, 1fr);
        gap: 10px;
        padding: 7px 0;
        border-top: 1px dashed rgba(222, 214, 200, 0.82);
        line-height: 1.55;
      }
      #${PANEL_ID} .arf-row:first-child {
        border-top: 0;
        padding-top: 0;
      }
      #${PANEL_ID} .arf-row-label {
        color: #7a7164;
        font-size: 12px;
      }
      #${PANEL_ID} .arf-row-value {
        color: #26231e;
        white-space: pre-wrap;
        word-break: break-word;
      }
      #${PANEL_ID} .arf-row-value.is-empty {
        color: #aaa196;
      }
      #${PANEL_ID} .arf-empty {
        padding: 12px;
        border: 1px dashed #ded6c8;
        border-radius: 12px;
        color: #6f6a60;
        background: #fffdf8;
        line-height: 1.5;
      }
      #${PANEL_ID} .arf-footer {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;
        padding: 8px 0 0;
        border-top: 1px solid rgba(231, 223, 209, 0.9);
        background: linear-gradient(180deg, rgba(250, 246, 236, 0), rgba(250, 246, 236, 0.98) 18%);
      }
      #${PANEL_ID} .arf-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      #${PANEL_ID} .arf-actions button {
        min-height: 34px;
        border: 0;
        border-radius: 10px;
        background: #0f6b4f;
        color: #fff;
        cursor: pointer;
      }
      #${PANEL_ID} .arf-actions button.secondary {
        background: #eaf2ed;
        color: #0f6b4f;
      }
      #${PANEL_ID} .arf-actions button.ghost {
        background: #f5f1e8;
        color: #4b463f;
      }
      #${PANEL_ID} .arf-actions button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      #${PANEL_ID} .arf-meta {
        color: #6f6a60;
        font-size: 12px;
        line-height: 1.45;
      }
      #${PANEL_ID} .arf-progress {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      #${PANEL_ID} .arf-progress[hidden] {
        display: none;
      }
      #${PANEL_ID} .arf-progress-track {
        height: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(15, 107, 79, 0.12);
      }
      #${PANEL_ID} .arf-progress-fill {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #0f6b4f, #d48a1f);
        transition: width 0.25s ease;
      }
      #${PANEL_ID} .arf-progress-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        color: #6f6a60;
        font-size: 11px;
        line-height: 1.35;
      }
      #${PANEL_ID} .arf-progress-meta span:last-child {
        min-width: 0;
        overflow: hidden;
        text-align: right;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function markElement(element, mark, title) {
    injectStyle();
    element.setAttribute(MARK_ATTR, mark);
    if (title) {
      element.setAttribute("title", title);
    }
  }

  function clearMarks() {
    document.querySelectorAll(`[${MARK_ATTR}]`).forEach((element) => {
      element.removeAttribute(MARK_ATTR);
    });
    autofillSummary = null;
    const floating = document.getElementById(FLOAT_ID);
    if (floating) {
      floating.hidden = true;
    }
  }

  function ensureFloatingStatus() {
    injectStyle();
    let floating = document.getElementById(FLOAT_ID);
    if (floating) {
      return floating;
    }

    floating = document.createElement("div");
    floating.id = FLOAT_ID;
    floating.hidden = true;
    floating.innerHTML = `
      <div class="arf-float-head">
        <div>
          <div class="arf-float-title" data-role="float-title">简历填写中</div>
          <div class="arf-float-detail" data-role="float-detail">正在准备...</div>
        </div>
        <button class="arf-float-close" type="button" data-action="float-hide" title="隐藏">×</button>
      </div>
      <div class="arf-float-privacy">隐私：资料只保存在本机；插件不会自动提交。</div>
      <div class="arf-float-ai" data-role="float-ai" hidden></div>
      <div class="arf-float-progress" data-role="float-progress">
        <div class="arf-float-track">
          <div class="arf-float-fill" data-role="float-fill"></div>
        </div>
      </div>
      <div class="arf-float-chips" data-role="float-chips" hidden></div>
      <div class="arf-float-actions">
        <button type="button" data-action="float-detail">打开资料面板</button>
        <button class="secondary" type="button" data-action="float-clear">清除颜色标记</button>
      </div>
    `;

    floating.querySelector('[data-action="float-hide"]')?.addEventListener("click", () => {
      floating.hidden = true;
    });
    floating.querySelector('[data-action="float-detail"]')?.addEventListener("click", () => {
      showProfilePanel();
      renderProfilePanel();
    });
    floating.querySelector('[data-action="float-clear"]')?.addEventListener("click", clearMarks);

    document.documentElement.appendChild(floating);
    return floating;
  }

  function setAutofillSummary(summary) {
    const failed = Number(summary?.failed || 0);
    const skipped = Number(summary?.skipped || 0);
    autofillSummary = {
      attempted: Number(summary?.attempted || 0),
      filled: Number(summary?.filled || 0),
      failed,
      skipped,
      pending: Number(summary?.pending ?? skipped + failed),
      missing: Number(summary?.missing || 0),
      total: Number(summary?.total || 0),
      message: normalizeText(summary?.message || "", 160),
      aiUsage: sanitizeAutofillAiUsage(summary?.aiUsage || getAutofillAiSnapshot())
    };
    renderFloatingStatus();
  }

  function renderFloatingStatus() {
    const shouldShow = Boolean(autofillProgress.active || autofillSummary || learningRecords.length > 0);
    const floating = ensureFloatingStatus();
    floating.hidden = !shouldShow;
    if (!shouldShow) {
      return;
    }

    const title = floating.querySelector('[data-role="float-title"]');
    const detail = floating.querySelector('[data-role="float-detail"]');
    const aiFlag = floating.querySelector('[data-role="float-ai"]');
    const progress = floating.querySelector('[data-role="float-progress"]');
    const fill = floating.querySelector('[data-role="float-fill"]');
    const chips = floating.querySelector('[data-role="float-chips"]');

    if (autofillProgress.active) {
      const modeBadge = getAutofillModeBadgeText(autofillAiState, autofillProgress);
      if (title) {
        title.textContent = getAutofillProgressTitle() || "正在填写";
      }
      if (detail) {
        detail.textContent = getAutofillProgressDetail();
      }
      if (progress) {
        progress.hidden = false;
      }
      if (fill) {
        fill.style.width = `${getDisplayedProgressPercent()}%`;
      }
      if (chips) {
        chips.hidden = true;
        chips.textContent = "";
      }
      if (aiFlag) {
        aiFlag.hidden = !modeBadge;
        aiFlag.textContent = modeBadge || "";
      }
      return;
    }

    const summary = autofillSummary || {};
    const learningCount = learningRecords.length;
    const modeBadge = autofillSummary ? getAutofillCompletionBadgeText(summary.aiUsage || autofillAiState) : "";
    if (title) {
      title.textContent = autofillSummary ? "填写完成" : "资料更新建议";
    }
    if (detail) {
      detail.textContent = autofillSummary
        ? summary.message || "请直接在页面上检查绿色已填写和橙色待处理标记。"
        : `本页有 ${learningCount} 处修改可以写入本机资料库。`;
    }
    if (progress) {
      progress.hidden = true;
    }
    if (chips) {
      chips.hidden = false;
      chips.textContent = "";
      if (autofillSummary) {
        const missing = Number(summary.missing || 0);
        chips.style.gridTemplateColumns = `repeat(${missing > 0 ? 3 : 2}, minmax(0, 1fr))`;
        chips.append(
          createFloatChip("is-ok", summary.filled || 0, "已填写"),
          createFloatChip("is-warn", summary.pending || 0, "待处理")
        );
        if (missing > 0) {
          chips.append(createFloatChip("is-missing", missing, "缺资料"));
        }
      } else {
        chips.style.gridTemplateColumns = "";
      }
      if (learningCount > 0) {
        const learnChip = document.createElement("button");
        learnChip.type = "button";
        learnChip.className = "arf-float-chip is-learn";
        learnChip.dataset.action = "float-learn";
        const count = document.createElement("strong");
        count.textContent = String(learningCount);
        learnChip.append(count, document.createTextNode("处修改 · 点击更新资料库"));
        learnChip.addEventListener("click", () => {
          void openLearningPanel();
        });
        chips.append(learnChip);
      }
    }
    if (aiFlag) {
      aiFlag.hidden = !modeBadge;
      aiFlag.textContent = modeBadge || "";
    }
  }

  function createFloatChip(className, count, label) {
    const chip = document.createElement("div");
    chip.className = `arf-float-chip ${className}`;
    const strong = document.createElement("strong");
    strong.textContent = String(count);
    chip.append(strong, document.createTextNode(label));
    return chip;
  }

  function setProfilePanelStatus(message, isError = false) {
    const panel = ensureProfilePanel();
    const statusEl = panel.querySelector('[data-role="status"]');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.color = isError ? "#b23b3b" : "#6f6a60";
    }
  }

  function setProfilePanelVisible(nextVisible) {
    profilePanelVisible = Boolean(nextVisible);
    const panel = ensureProfilePanel();
    panel.setAttribute(PANEL_HIDDEN_ATTR, profilePanelVisible ? "false" : "true");
    panel.setAttribute(PANEL_COLLAPSED_ATTR, profilePanelCollapsed ? "true" : "false");
    if (profilePanelVisible) {
      renderAndSaveProfilePanel();
    } else {
      queueProfilePanelStateSave();
    }
  }

  function showProfilePanel() {
    setProfilePanelVisible(true);
    void refreshCurrentProfile();
  }

  function toggleProfilePanelCollapsed() {
    profilePanelCollapsed = !profilePanelCollapsed;
    renderAndSaveProfilePanel();
  }

  function ensureProfilePanel() {
    injectStyle();
    if (profilePanel && document.contains(profilePanel)) {
      return profilePanel;
    }

    const stalePanel = document.getElementById(PANEL_ID);
    if (stalePanel) {
      stalePanel.remove();
    }

    const panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.setAttribute(PANEL_HIDDEN_ATTR, "true");
    panel.setAttribute(PANEL_COLLAPSED_ATTR, "false");

    const header = document.createElement("div");
    header.className = "arf-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "arf-title";
    title.textContent = "AI-Powered OpenJobAutofill";
    const subtitle = document.createElement("div");
    subtitle.className = "arf-subtitle";
    subtitle.dataset.role = "subtitle";
    subtitle.textContent = "本机简历资料。用于查看、搜索和复制；开始填写会扫描并自动填写当前网页。";
    titleWrap.append(title, subtitle);

    const headerActions = document.createElement("div");
    headerActions.className = "arf-header-actions";

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "arf-toggle";
    collapseBtn.dataset.action = "collapse";
    collapseBtn.textContent = "收起";
    collapseBtn.addEventListener("click", toggleProfilePanelCollapsed);

    const homeBtn = document.createElement("button");
    homeBtn.type = "button";
    homeBtn.className = "arf-home";
    homeBtn.dataset.action = "home";
    homeBtn.textContent = "主页";
    homeBtn.addEventListener("click", goProfilePanelHome);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "arf-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => setProfilePanelVisible(false));
    headerActions.append(collapseBtn, homeBtn, closeBtn);
    header.append(titleWrap, headerActions);

    const body = document.createElement("div");
    body.className = "arf-body";

    const searchInput = document.createElement("input");
    searchInput.className = "arf-search";
    searchInput.dataset.role = "quick-copy-search";
    searchInput.type = "search";
    searchInput.placeholder = "搜索分类或内容，例如 手机 / 项目 / 奖学金";
    searchInput.addEventListener("input", () => {
      sidebarFilter = normalizeText(searchInput.value || "", 80);
      activeProfileCategory = "";
      renderQuickCopyList(panel);
      queueProfilePanelStateSave();
    });

    const content = document.createElement("div");
    content.className = "arf-content";
    content.dataset.role = "quick-copy-list";
    content.textContent = "资料加载中...";

    const status = document.createElement("div");
    status.className = "arf-meta";
    status.dataset.role = "status";
    status.textContent = "资料只从本机读取。";

    const progress = document.createElement("div");
    progress.className = "arf-progress";
    progress.dataset.role = "progress";
    progress.hidden = true;
    progress.innerHTML = `
      <div class="arf-progress-track">
        <div class="arf-progress-fill" data-role="progress-fill"></div>
      </div>
      <div class="arf-progress-meta">
        <span data-role="progress-stage"></span>
        <span data-role="progress-detail"></span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "arf-actions";

    const copyCategoryBtn = document.createElement("button");
    copyCategoryBtn.type = "button";
    copyCategoryBtn.dataset.action = "copy-category";
    copyCategoryBtn.textContent = "复制本类";
    copyCategoryBtn.disabled = true;
    copyCategoryBtn.addEventListener("click", () => {
      void copyActiveCategory();
    });

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "secondary";
    refreshBtn.dataset.action = "refresh";
    refreshBtn.textContent = "刷新";
    refreshBtn.addEventListener("click", () => {
      void refreshCurrentProfile({ force: true });
    });

    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.className = "ghost";
    settingsBtn.dataset.action = "settings";
    settingsBtn.textContent = "设置";
    settingsBtn.addEventListener("click", () => {
      void openOptionsPageFromProfilePanel();
    });

    actions.append(copyCategoryBtn, refreshBtn, settingsBtn);

    const footer = document.createElement("div");
    footer.className = "arf-footer";

    footer.append(status, progress, actions);

    body.append(searchInput, content);
    panel.append(header, body, footer);
    document.documentElement.appendChild(panel);
    profilePanel = panel;
    return panel;
  }

  async function openOptionsPageFromProfilePanel() {
    try {
      await sendRuntimeMessage({ type: "OJAF_OPEN_OPTIONS" });
      setProfilePanelStatus("已打开设置页。");
    } catch (error) {
      setProfilePanelStatus(`打开设置失败：${error.message}`, true);
    }
  }

  async function refreshCurrentProfile(options = {}) {
    if (currentProfileLoadPromise && !options.force) {
      return currentProfileLoadPromise;
    }

    currentProfileLoadPromise = (async () => {
      const settings = await sendRuntimeMessage({ type: "OJAF_GET_SETTINGS" });
      currentProfileV2 = settings.profileV2 || null;
      learningTrackingEnabled = settings.preferences?.learnFromEdits !== false;
      learningAutoClassify = settings.preferences?.autoClassifyLearning !== false;
      aiValueMatchingEnabled = settings.preferences?.aiValueMatching === true;
      const api = settings.apiConfig || {};
      currentApiUsable = api.mode === "custom" ? Boolean(api.customUrl) : Boolean(api.baseUrl && api.model);
      return currentProfileV2;
    })();

    try {
      const profile = await currentProfileLoadPromise;
      if (profilePanelVisible) {
        renderProfilePanel();
      }
      if (options.force && profilePanelVisible) {
        setProfilePanelStatus("已刷新本机简历资料。");
      }
      return profile;
    } catch (error) {
      if (profilePanelVisible) {
        setProfilePanelStatus(`读取本机资料失败：${error.message}`, true);
      }
      return null;
    } finally {
      currentProfileLoadPromise = null;
    }
  }

  function formatQuickCopyValue(value, maxLength = 64) {
    if (value == null || value === "") {
      return "";
    }

    if (typeof value === "string") {
      return normalizeText(value, maxLength);
    }

    if (typeof value === "object") {
      try {
        return normalizeText(JSON.stringify(value), maxLength);
      } catch {
        return normalizeText(String(value), maxLength);
      }
    }

    return normalizeText(String(value), maxLength);
  }

  function normalizeProfileCategory(title) {
    const text = normalizeText(title, 80);
    if (!text) {
      return "其他信息";
    }

    if (/基本|个人信息|联系方式/.test(text)) {
      return "基本信息";
    }
    if (/求职意向|意向岗位|期望薪资|期望工作|面试城市/.test(text)) {
      return "求职意向";
    }
    if (/教育|学历|学校/.test(text)) {
      return "教育经历";
    }
    if (/项目/.test(text)) {
      return "项目经历";
    }
    if (/实习|实践/.test(text)) {
      return "实习经历";
    }
    if (/工作经历/.test(text)) {
      return "工作经历";
    }
    if (/绩效考核|考核等级|考核排名/.test(text)) {
      return "绩效考核";
    }
    if (/专业技术资格|职业资格|职称/.test(text)) {
      return "专业资格";
    }
    if (/社团|校园活动/.test(text)) {
      return "社团工作";
    }
    if (/学生工作|班委|学生会|干部任职|在校职务/.test(text)) {
      return "学生工作";
    }
    if (/奖|惩|荣誉|成果/.test(text)) {
      return "奖惩情况";
    }
    if (/外语能力|外语|英语|四六级|CET|IELTS|TOEFL|GRE|GMAT/i.test(text)) {
      return "外语能力";
    }
    if (/计算机技能|IT技能|计算机能力/.test(text)) {
      return "计算机技能";
    }
    if (/证书|技能|计算机/.test(text)) {
      return "证书技能";
    }
    if (/语言|语种/i.test(text)) {
      return "语言能力";
    }
    if (/家庭|亲属|父亲|母亲|社会关系/.test(text)) {
      return "家庭信息";
    }
    if (/培训/.test(text)) {
      return "培训经历";
    }
    if (/论文|著作|刊物/.test(text)) {
      return "论文著作";
    }
    if (/专利/.test(text)) {
      return "专利成果";
    }
    if (/自我描述|自我评价|自我介绍/.test(text)) {
      return "自我描述";
    }
    if (/声明|疾病|不良|居留|任职|持股|调剂/.test(text)) {
      return "有关声明";
    }
    if (/自定义|补充/.test(text)) {
      return "自定义资料";
    }

    return text;
  }

  function getCurrentProfileSections() {
    return profileV2ToProfileSections(currentProfileV2);
  }

  function getCurrentProfileEntries() {
    const entries = [];
    for (const section of getCurrentProfileSections()) {
      for (const item of section.items) {
        const itemIndex = entries.length;
        entries.push({
          ...item,
          itemId: item.itemId || `profileV2.unknown.items[${itemIndex}].value`,
          category: section.category,
          sectionKey: section.category,
          aliases: item.aliases || buildProfileItemAliases(section, item)
        });
      }
    }
    return entries;
  }

  function hasCurrentProfileData() {
    return getCurrentProfileSections().length > 0;
  }

  function profileV2ToProfileSections(profileV2) {
    if (!profileV2 || typeof profileV2 !== "object") {
      return [];
    }

    const sections = [];
    const sourceSections = profileV2.sections && typeof profileV2.sections === "object" ? profileV2.sections : {};
    for (const [sectionKey, section] of Object.entries(sourceSections)) {
      appendProfileV2Section(sections, sectionKey, section);
    }
    for (const [index, section] of (Array.isArray(profileV2.customSections) ? profileV2.customSections : []).entries()) {
      appendProfileV2Section(sections, section.key || `custom-${index}`, section);
    }

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.label)
      }))
      .filter((section) => section.items.length > 0);
  }

  function appendProfileV2Section(sections, sectionKey, section) {
    if (!section || typeof section !== "object") {
      return;
    }

    const category = normalizeProfileCategory(section.title || sectionKey || "其他信息");
    const target = ensureProfileSection(sections, category, section.title || category);
    if (section.kind === "repeat") {
      const items = Array.isArray(section.items) ? section.items : [];
      items.forEach((item, itemIndex) => {
        const baseSubsection = normalizeText(item?.title || `${section.title || category} ${itemIndex + 1}`, 120);
        const familyRelation = category === "家庭信息" ? getFamilyRelationFromProfileItem(item, baseSubsection) : "";
        const subsection = buildProfileItemSubsection(baseSubsection, familyRelation);
        appendProfileV2Values(target, item?.values, {
          sectionKey,
          subsection,
          familyRelation,
          prefix: `profileV2.sections.${sectionKey}.items[${itemIndex}].values`
        });
        appendProfileV2CustomRows(target, item?.custom, {
          sectionKey,
          subsection,
          familyRelation,
          prefix: `profileV2.sections.${sectionKey}.items[${itemIndex}].custom`
        });
      });
      return;
    }

    appendProfileV2Values(target, section.values, {
      sectionKey,
      subsection: "",
      familyRelation: "",
      prefix: `profileV2.sections.${sectionKey}.values`
    });
    appendProfileV2CustomRows(target, section.custom, {
      sectionKey,
      subsection: "",
      familyRelation: "",
      prefix: `profileV2.sections.${sectionKey}.custom`
    });
  }

  function getFamilyRelationFromProfileItem(item, fallbackText = "") {
    const titleRelation = getFamilyRelationFromText(fallbackText);
    if (titleRelation) {
      return titleRelation;
    }

    const values = item?.values && typeof item.values === "object" ? item.values : {};
    for (const [label, value] of Object.entries(values)) {
      if (/关系|与本人关系|亲属关系/.test(normalizeMatchKey(label))) {
        const relation = getFamilyRelationFromText(value);
        if (relation) {
          return relation;
        }
      }
    }
    return "";
  }

  function buildProfileItemSubsection(baseSubsection, familyRelation) {
    const base = normalizeText(baseSubsection, 120);
    const relation = normalizeText(familyRelation, 40);
    if (!base) {
      return relation;
    }
    if (!relation || getFamilyRelationFromText(base) === relation) {
      return base;
    }
    return normalizeText(`${base} ${relation}`, 120);
  }

  function ensureProfileSection(sections, category, sourceTitle) {
    let section = sections.find((item) => item.category === category);
    if (!section) {
      section = { category, sourceTitles: [], items: [] };
      sections.push(section);
    }
    if (sourceTitle && !section.sourceTitles.includes(sourceTitle)) {
      section.sourceTitles.push(sourceTitle);
    }
    return section;
  }

  function getProfileSectionTitle(section) {
    if (!section) {
      return "";
    }

    const sourceTitle = Array.isArray(section.sourceTitles)
      ? section.sourceTitles.find((title) => Boolean(normalizeText(title, 120)))
      : "";
    return normalizeText(sourceTitle || section.category || "", 120);
  }

  function appendProfileV2Values(section, values, context) {
    if (!values || typeof values !== "object") {
      return;
    }
    let index = 0;
    for (const [label, value] of Object.entries(values)) {
      appendProfileV2Entry(section, {
        label,
        value,
        subsection: context.subsection,
        familyRelation: context.familyRelation,
        itemId: `${context.prefix}[${index}]`
      });
      index += 1;
    }
  }

  function appendProfileV2CustomRows(section, rows, context) {
    if (!Array.isArray(rows)) {
      return;
    }
    rows.forEach((row, index) => {
      appendProfileV2Entry(section, {
        label: row?.label || "",
        value: row?.value || "",
        subsection: context.subsection,
        familyRelation: context.familyRelation,
        itemId: `${context.prefix}[${index}].value`
      });
    });
  }

  function appendProfileV2Entry(section, entry) {
    const label = normalizeText(entry.label || "", 120);
    const value = String(entry.value == null ? "" : entry.value).trim();
    if (!label || !value) {
      return;
    }

    const item = {
      label,
      value,
      preview: formatQuickCopyValue(value, 96),
      hasValue: true,
      subsection: normalizeText(entry.subsection || "", 120),
      familyRelation: normalizeText(entry.familyRelation || "", 40),
      itemId: entry.itemId || `profileV2.items[${section.items.length}].value`
    };
    item.aliases = buildProfileItemAliases(section, item);
    section.items.push(item);
  }

  function normalizeMatchKey(value) {
    return compactText(value)
      .replace(/[()（）[\]【】<>《》"'“”‘’、,，。．·•\s|:：/\\-]/g, "")
      .replace(/[0-9]/g, "");
  }

  function inferFieldLabel(field) {
    const candidates = [];
    for (const value of [field?.label, field?.nearbyText, field?.placeholder, field?.name, field?.id, field?.title]) {
      const text = normalizeText(value, 280);
      if (text) {
        candidates.push(text);
      }
    }

    for (const candidate of candidates) {
      const parts = candidate.split(/\s*\|\s*/).map((part) => normalizeText(part, 120)).filter(Boolean);
      for (const part of parts) {
        const cleaned = part
          .replace(/^[*•\s]+/, "")
          .replace(/^[（(]?(必填|选填)[)）]?\s*/, "")
          .replace(/^(请输入|请选择|请填写|请写明|点击选择)\s*/, "")
          .replace(/[:：]\s*(请输入|请选择|上传文件)?$/, "")
          .replace(/\s*(请输入|请选择|点击选择|选择)$/g, "")
          .trim();
        if (
          cleaned &&
          cleaned.length <= 80 &&
          /[\u4e00-\u9fa5A-Za-z]/.test(cleaned) &&
          !/请输入|请选择|上传文件|内容列表|搜索分类或内容|OpenJobAutofill/.test(cleaned)
        ) {
          return cleaned.replace(/^[*•\s]+/, "");
        }
      }
    }

    return normalizeText(field?.label || field?.nearbyText || "", 80);
  }

  function isFamilyRelationLabel(label) {
    const key = normalizeMatchKey(label);
    return /^(关系|与本人关系|亲属关系|家庭关系|社会关系)$/.test(key);
  }

  function isFamilyMemberDetailLabel(label) {
    const key = normalizeMatchKey(label);
    return /^(姓名|出生日期|出生年月|生日|性别|政治面貌|学历|工作单位|单位名称|公司|职务|职位|岗位|联系电话|电话|手机号码|是否退休|退休情况|备注|联系地址|通讯地址|地址|住址)$/.test(key);
  }

  function isFamilyMemberLabel(label) {
    return isFamilyRelationLabel(label) || isFamilyMemberDetailLabel(label);
  }

  function getFamilyContextKey(field) {
    return compactText([
      field?.groupText,
      getFieldOptionLabelsText(field, 180),
      field?.section,
      field?.nearbyText,
      field?.label,
      field?.placeholder
    ].join(" "));
  }

  function isLikelyFamilyMemberContext(field, label = "") {
    const key = getFamilyContextKey(field);
    const labelKey = normalizeMatchKey(label || field?.label || "");
    if (!key || /紧急联系人/.test(key)) {
      return false;
    }

    if (/是否存在亲属.*(应聘单位|本行|我行)|亲属在.*(应聘单位|本行|我行)|有关声明|电子签名/.test(key)) {
      return false;
    }

    if (/家庭情况|家庭信息|家庭及社会关系|社会关系|亲属信息|亲属情况|亲属关系|与本人关系|是否退休/.test(key)) {
      return true;
    }

    if (!isFamilyMemberLabel(labelKey)) {
      return false;
    }

    const indicators = [
      /关系|与本人关系|亲属关系/,
      /姓名/,
      /出生日期|出生年月/,
      /政治面貌/,
      /学历/,
      /工作单位|单位名称|公司/,
      /职务|职位|岗位/,
      /联系电话|手机号码|电话/,
      /是否退休|退休情况/
    ];
    const indicatorCount = indicators.reduce((count, pattern) => count + (pattern.test(key) ? 1 : 0), 0);
    return /关系|与本人关系|亲属关系/.test(key) && indicatorCount >= 4;
  }

  function isFamilyScopedField(field, fieldLabel, fieldCategory) {
    return fieldCategory === "家庭信息" || isLikelyFamilyMemberContext(field, fieldLabel);
  }

  function inferMatchSection(field) {
    const label = normalizeMatchKey(field?.inferredLabel || field?.label || "");
    if (isLikelyFamilyMemberContext(field, label)) {
      return "家庭信息";
    }

    const text = compactText([field?.groupText, getFieldOptionLabelsText(field, 180), field?.section, field?.nearbyText, field?.label].join(" "));
    if (!text) {
      return "";
    }

    if (/自我评价|自我描述|自我介绍|相关情况说明/.test(text)) {
      return "自我描述";
    }
    if (/近三年年度绩效考核|绩效考核|考核年度|考核等级/.test(text)) {
      return "绩效考核";
    }
    if (/证明人|联系方式|备注/.test(label) && /排名|考核|绩效|证明人/.test(text) && !/实习|实践|项目/.test(text)) {
      return "绩效考核";
    }
    if (/专业技术资格|职业资格|职称/.test(text)) {
      return "专业资格";
    }
    if (/有关声明|声明|永居权|永久居留|背景调查|事实完全相符|非法组织|重大疾病|传染病|行政处罚|失信被执行人|境外居留|第三方企业|任兼职|持有企业股权|用人单位辞退/.test(text)) {
      return "有关声明";
    }
    if (/家庭情况|家庭信息|家庭及社会关系|社会关系|亲属信息|亲属情况|亲属关系|与本人关系|是否退休/.test(text)) {
      return "家庭信息";
    }
    if (/求职意向|意向岗位|预计入职|期望工作城市|期望薪资|当前薪资|当前年收入|面试城市|意向城市|目标岗位|简历来源|目前工作地/.test(text)) {
      return "求职意向";
    }
    if (
      /个人信息|基本信息/.test(text) ||
      /^(姓名|性别|出生日期|民族|政治面貌|籍贯|户口所在地|现户口所在地|当前居住地|当前居住地详细地址|净身高cm|身高|体重kg|体重|血型|婚姻状况|电子邮箱|手机号码|电话)$/.test(label)
    ) {
      return "基本信息";
    }
    if (/证书信息|证书类别|证书名称|发证单位|证书编号/.test(text)) {
      return "证书技能";
    }
    if (/教育经历|学历|学校名称|学院名称|专业名称|培养方式|升学类型/.test(text)) {
      return "教育经历";
    }
    if (/工作经历|有无工作经历|现工作单位|当前工作单位|工作职责/.test(text)) {
      return "工作经历";
    }
    if (/工作实习经历|工作\/实习经历|实习经历|实践|单位名称|职位名称/.test(text)) {
      return "实习经历";
    }
    if (/在校职务|社团|学生工作|部门名称/.test(text)) {
      return /学生工作/.test(text) ? "学生工作" : "社团工作";
    }
    if (/奖惩信息|奖惩情况|奖惩名称|奖惩时间|奖励|荣誉|获奖|学术成果/.test(text)) {
      return "奖惩情况";
    }
    if (/技能|资格证书|证书|计算机水平|其它技能|语言能力|语言类型|四六级|六级|四级|TOEFL|IELTS|GRE|GMAT/i.test(text)) {
      if (/语言|外语|四六级|六级|四级|TOEFL|IELTS|GRE|GMAT/i.test(text)) {
        return "外语能力";
      }
      if (/计算机|IT技能|计算机水平|其它技能/.test(text)) {
        return "计算机技能";
      }
      return "证书技能";
    }
    if (/培训经历|培训名称|培训机构|培训课程/.test(text)) {
      return "培训经历";
    }
    if (/论文|著作|刊物名称|论文名称/.test(text)) {
      return "论文著作";
    }
    if (/专利|专利名称|专利编号/.test(text)) {
      return "专利成果";
    }
    if (/受到奖励|学术成果|社会校园活动|社会\/校园活动|校园活动|兴趣爱好|特长|爱好及专长/.test(text)) {
      return "其他信息";
    }
    if (/是否|有无|能否|同意|接受|服从/.test(text) && /亲属|调剂|背景|居留|疾病|处罚|任职|持股|股票/.test(text)) {
      return "有关声明";
    }
    if (/其他信息|其他个人情况|附加信息|附加问题/.test(text)) {
      return "其他信息";
    }
    return "";
  }

  function buildProfileItemAliases(section, item) {
    const aliases = new Set();
    const label = normalizeText(item?.label || "", 120);
    const subsection = normalizeText(item?.subsection || "", 120);
    const category = normalizeText(section?.category || "", 120);
    const labelKey = normalizeMatchKey(label);

    if (label) {
      aliases.add(label);
      aliases.add(labelKey);
    }
    if (subsection) {
      aliases.add(subsection);
      aliases.add(normalizeMatchKey(subsection));
    }
    if (category) {
      aliases.add(category);
      aliases.add(normalizeMatchKey(category));
    }

    const aliasList = PROFILE_LABEL_ALIASES[label] || PROFILE_LABEL_ALIASES[labelKey] || [];
    for (const alias of aliasList) {
      aliases.add(alias);
      aliases.add(normalizeMatchKey(alias));
    }

    return Array.from(aliases).filter(Boolean);
  }

  function buildProfileCatalogFromEntries(entries) {
    const sectionMap = new Map();
    const fields = [];

    for (const entry of entries) {
      if (!entry?.itemId || !entry?.label) {
        continue;
      }

      const field = {
        path: entry.itemId,
        label: [entry.category, entry.subsection, entry.label].filter(Boolean).join(" / "),
        aliases: Array.from(new Set([entry.label, entry.subsection, entry.category, ...(entry.aliases || [])].filter(Boolean)))
      };
      fields.push(field);

      const key = entry.category || "本地资料";
      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          key,
          title: key,
          fields: []
        });
      }
      sectionMap.get(key).fields.push(field);
    }

    return {
      sections: Array.from(sectionMap.values()),
      fields
    };
  }

  function getProfileEntryByPath(entries, path) {
    if (!path) {
      return null;
    }
    return entries.find((entry) => entry.itemId === path) || null;
  }

  function getScanFieldById(scan, fieldId) {
    const fields = Array.isArray(scan?.fields) ? scan.fields : [];
    return fields.find((field) => field.fieldId === fieldId) || null;
  }

  function getEntryCategoryBonus(fieldCategory, entryCategory) {
    if (!fieldCategory || !entryCategory) {
      return 0;
    }

    if (fieldCategory === entryCategory) {
      return 14;
    }

    const compatiblePairs = new Map([
      ["基本信息", ["其他信息", "教育经历"]],
      ["教育经历", ["基本信息"]],
      ["实习经历", ["项目经历"]],
      ["项目经历", ["实习经历"]],
      ["工作经历", ["实习经历"]],
      ["绩效考核", ["工作经历"]],
      ["社团工作", ["学生工作"]],
      ["学生工作", ["社团工作"]],
      ["专业资格", ["证书技能"]],
      ["外语能力", ["语言能力", "证书技能"]],
      ["语言能力", ["外语能力", "证书技能"]],
      ["计算机技能", ["证书技能", "其他信息"]],
      ["证书技能", ["外语能力", "计算机技能", "其他信息", "专业资格"]],
      ["自我描述", ["其他信息"]],
      ["有关声明", ["其他信息"]]
    ]);

    const compatible = compatiblePairs.get(fieldCategory) || [];
    return compatible.includes(entryCategory) ? 6 : -8;
  }

  function isExplanatoryField(text) {
    const key = normalizeMatchKey(text);
    if (/自我评价|自我描述|自我介绍|相关情况说明/.test(key)) {
      return false;
    }
    return /原因|说明|理由|备注/.test(key);
  }

  function isExplanatoryEntry(text) {
    return /原因|说明|理由|备注/.test(normalizeMatchKey(text));
  }

  function isCategoryCompatibleForMapping(fieldCategory, entryCategory) {
    if (!fieldCategory || !entryCategory) {
      return true;
    }

    if (fieldCategory === entryCategory) {
      return true;
    }

    const compatiblePairs = new Map([
      ["基本信息", ["其他信息", "教育经历"]],
      ["实习经历", ["项目经历", "工作经历"]],
      ["工作经历", ["实习经历"]],
      ["绩效考核", ["工作经历"]],
      ["项目经历", ["实习经历"]],
      ["社团工作", ["学生工作"]],
      ["学生工作", ["社团工作"]],
      ["专业资格", ["证书技能"]],
      ["外语能力", ["语言能力", "证书技能"]],
      ["语言能力", ["外语能力", "证书技能"]],
      ["计算机技能", ["证书技能", "其他信息"]],
      ["证书技能", ["外语能力", "语言能力", "计算机技能", "专业资格"]],
      ["有关声明", ["其他信息"]],
      ["自我描述", ["其他信息"]],
      ["其他信息", ["有关声明", "奖惩情况", "社团工作", "学生工作", "自我描述"]]
    ]);

    return (compatiblePairs.get(fieldCategory) || []).includes(entryCategory);
  }

  function isNameLikeLabel(labelKey) {
    return /姓名|联系人|证明人|推荐人|介绍人/.test(labelKey);
  }

  function isPhoneLikeLabel(labelKey) {
    return /电话|手机|联系方式|联系电话|手机号/.test(labelKey);
  }

  function isRoleLikeLabel(labelKey) {
    return /职务|职位|岗位|角色/.test(labelKey);
  }

  function isRelationLikeLabel(labelKey) {
    return /关系|与本人关系|亲属关系/.test(labelKey);
  }

  function hasRelationLikeOptions(optionText) {
    return /父亲|母亲|爸爸|妈妈|配偶|爱人|丈夫|妻子|兄弟|姐妹|哥哥|姐姐|弟弟|妹妹|儿子|女儿|朋友|同学|同事|亲属|关系/.test(optionText);
  }

  function getContextualAddressBucket(key, labelKey) {
    const provinceLike = /省|省份/.test(labelKey);
    const cityLike = /市|城市|地区/.test(labelKey);
    const addressLike = /地址|住址|详细地址|街道|门牌|通讯|通信|邮寄|收件/.test(labelKey);

    if (/籍贯/.test(key)) {
      if (provinceLike || /籍贯省/.test(key)) {
        return "nativeProvince";
      }
      if (cityLike || /籍贯市/.test(key)) {
        return "nativeCity";
      }
      return "nativePlace";
    }

    if (/生源地|生源户口|生源所在地/.test(key)) {
      if (provinceLike || /生源地省/.test(key)) {
        return "sourceProvince";
      }
      if (cityLike || /生源地市/.test(key)) {
        return "sourceCity";
      }
      return "sourcePlace";
    }

    if (/户口|户籍/.test(key)) {
      if (provinceLike || /户口所在地省|户籍所在地省/.test(key)) {
        return "hukouProvince";
      }
      if (cityLike || /户口所在地市|户籍所在地市/.test(key)) {
        return "hukouCity";
      }
      return "hukouPlace";
    }

    if (/通讯地址|通信地址|联系地址|邮寄地址|收件地址/.test(key)) {
      return "mailingAddress";
    }

    if (/当前居住|现居住|现居地|居住城市|居住地|现住址/.test(key)) {
      if (addressLike || /详细地址|地址|住址|街道|门牌/.test(key)) {
        return "currentResidenceAddress";
      }
      return "currentResidenceCity";
    }

    return "";
  }

  function getContextualSemanticBucket(field, fieldLabel, fieldCategory) {
    const labelKey = normalizeMatchKey(fieldLabel || field?.label || "");
    const optionText = getFieldOptionLabelsText(field, 200);
    const key = compactText([
      fieldCategory,
      field?.groupText,
      field?.section,
      field?.nearbyText,
      field?.label,
      field?.placeholder,
      field?.name,
      field?.id,
      optionText
    ].join(" "));

    if (!key) {
      return "";
    }

    if (
      /家庭信息|家庭情况|家庭及社会关系|社会关系|亲属信息|亲属情况|亲属关系/.test(key) &&
      !/是否存在亲属.*(应聘单位|本行|我行)|亲属在.*(应聘单位|本行|我行)|有关声明|电子签名/.test(key)
    ) {
      if (isRelationLikeLabel(labelKey) || hasRelationLikeOptions(optionText)) {
        return "familyRelation";
      }
      if (/姓名/.test(labelKey)) {
        return "familyName";
      }
      if (/出生日期|出生年月|生日/.test(labelKey)) {
        return "familyBirthDate";
      }
      if (/政治面貌/.test(labelKey)) {
        return "familyPoliticalStatus";
      }
      if (/学历/.test(labelKey)) {
        return "familyEducationLevel";
      }
      if (/工作单位|单位名称|公司/.test(labelKey)) {
        return "familyEmployer";
      }
      if (isRoleLikeLabel(labelKey)) {
        return "familyRole";
      }
      if (isPhoneLikeLabel(labelKey)) {
        return "familyPhone";
      }
      if (/联系地址|通讯地址|地址|住址/.test(labelKey)) {
        return "familyAddress";
      }
      if (/是否退休|退休情况/.test(labelKey)) {
        return "familyRetired";
      }
    }

    if (/绩效考核|考核年度|考核等级/.test(key)) {
      if (isPhoneLikeLabel(labelKey)) {
        return "performanceContact";
      }
      if (isNameLikeLabel(labelKey)) {
        return "performanceReference";
      }
      if (/排名/.test(labelKey) || /排名/.test(key)) {
        return "performanceRank";
      }
      if (/绩效考核等级|考核等级/.test(labelKey) || /绩效考核等级|考核等级/.test(key)) {
        return "performanceLevel";
      }
      if (/说明|评语|备注/.test(labelKey) || /说明|评语|备注/.test(key)) {
        return "performanceNote";
      }
    }

    if (/紧急联系人|紧急联系方式/.test(key)) {
      if (isRelationLikeLabel(labelKey) || hasRelationLikeOptions(optionText)) {
        return "emergencyRelation";
      }
      if (isPhoneLikeLabel(labelKey)) {
        return "emergencyPhone";
      }
      if (isNameLikeLabel(labelKey) || /紧急联系人/.test(labelKey)) {
        return "emergencyContact";
      }
    }

    if (/证明人|推荐人|介绍人/.test(key) && !/紧急联系人/.test(key)) {
      if (isPhoneLikeLabel(labelKey)) {
        return "referencePhone";
      }
      if (isRoleLikeLabel(labelKey)) {
        return "referenceRole";
      }
      if (isNameLikeLabel(labelKey)) {
        return "referenceName";
      }
    }

    return getContextualAddressBucket(key, labelKey);
  }

  function getSemanticBucket(text, category = "") {
    const key = normalizeMatchKey([category, text].join(" "));
    if (!key) {
      return "";
    }

    if (/是否存在亲属.*(应聘单位|本行|我行)|亲属在.*(应聘单位|本行|我行)/.test(key)) {
      return "declarationRelativeAtEmployer";
    }

    if (/家庭信息|家庭情况|家庭及社会关系|社会关系|亲属信息|亲属情况|亲属关系/.test(key)) {
      if (/与本人关系|亲属关系|^家庭信息关系$|关系/.test(key)) {
        return "familyRelation";
      }
      if (/姓名/.test(key)) {
        return "familyName";
      }
      if (/出生日期|出生年月|生日/.test(key)) {
        return "familyBirthDate";
      }
      if (/政治面貌/.test(key)) {
        return "familyPoliticalStatus";
      }
      if (/学历/.test(key)) {
        return "familyEducationLevel";
      }
      if (/工作单位|单位名称|公司/.test(key)) {
        return "familyEmployer";
      }
      if (/职务|职位|岗位/.test(key)) {
        return "familyRole";
      }
      if (/联系电话|手机号码|电话/.test(key)) {
        return "familyPhone";
      }
      if (/联系地址|通讯地址|地址|住址/.test(key)) {
        return "familyAddress";
      }
      if (/是否退休|退休情况/.test(key)) {
        return "familyRetired";
      }
      if (/备注/.test(key)) {
        return "familyNote";
      }
    }

    if (/是否患有|传染病|高血压|心脏病|糖尿病|肾炎|精神病|影响工作的疾病|重大疾病/.test(key)) {
      return "declarationDisease";
    }
    if (/第三方企业|任兼职|持有企业股权|私募股权/.test(key)) {
      return "declarationThirdPartyEquity";
    }
    if (/不良行为记录|犯罪记录|行政处罚|党纪处分|违纪违规|失信被执行人/.test(key)) {
      return "declarationBadRecord";
    }
    if (/用人单位辞退|曾被辞退|辞退情况/.test(key)) {
      return "declarationDismissed";
    }
    if (/金融机构营销|业务风险/.test(key)) {
      return "declarationFinancialMarketingRisk";
    }
    if (/境外.*(长期|永久)居留权|永久居留权|永居权/.test(key)) {
      return "declarationOverseasResidence";
    }
    if (/教育经历.*最高学历/.test(key)) {
      return "isHighestEducation";
    }
    if (/最高全日制学历/.test(key)) {
      return "highestFullTimeEducation";
    }
    if (/最高学历/.test(key)) {
      return "highestEducationLevel";
    }
    if (/是否海外学历|是否海外教育经历|是否为海外教育经历/.test(key)) {
      return "overseasEducation";
    }
    if (/毕（结、肆）业|毕结肆业|毕业状态|毕业结业肄业在读/.test(key)) {
      return "graduationStatus";
    }
    if (/学历证书号/.test(key)) {
      return "educationCertificate";
    }
    if (/^学历$|学历层次|教育经历学历/.test(key)) {
      return "educationLevel";
    }
    if (/^学位$|学位类型|教育经历学位/.test(key)) {
      return "degree";
    }
    if (/绩效考核|考核年度|考核等级/.test(key)) {
      if (/联系方式|联系电话|电话/.test(key)) {
        return "performanceContact";
      }
      if (/证明人|推荐人/.test(key)) {
        return "performanceReference";
      }
      if (/排名/.test(key)) {
        return "performanceRank";
      }
      if (/绩效考核等级|考核等级/.test(key)) {
        return "performanceLevel";
      }
      if (/说明|评语|备注/.test(key)) {
        return "performanceNote";
      }
    }
    if (/专业技术资格|职业资格|职称/.test(key)) {
      if (/有无|是否/.test(key)) {
        return "professionalQualificationAvailable";
      }
      if (/职业资格证书|资格证书/.test(key)) {
        return "professionalCertificate";
      }
      return "professionalQualification";
    }
    if (/学校所在国家|学校国家/.test(key)) {
      return "schoolCountry";
    }
    if (/姓拼音|姓氏拼音/.test(key)) {
      return "lastNamePinyin";
    }
    if (/名拼音|名字拼音/.test(key)) {
      return "firstNamePinyin";
    }
    if (/^姓名$|真实姓名/.test(key)) {
      return "fullName";
    }
    if (/^姓$|中文姓|姓氏/.test(key)) {
      return "lastName";
    }
    if (/^名$|中文名|名字/.test(key)) {
      return "firstName";
    }
    if (/国籍|国家或地区/.test(key) && !/学校/.test(key)) {
      return "nationality";
    }
    if (/证件类型|身份证件类型/.test(key)) {
      return "idType";
    }
    if (/证件号码|身份证号|身份证号码/.test(key)) {
      return "idNumber";
    }
    if (/民族/.test(key)) {
      return "ethnicity";
    }
    if (/政治面貌|政治身份/.test(key)) {
      return "politicalStatus";
    }
    if (/婚姻状况|婚姻状态/.test(key)) {
      return "maritalStatus";
    }
    if (/血型|血液类型/.test(key)) {
      return "bloodType";
    }
    if (/净身高|身高/.test(key)) {
      return "height";
    }
    if (/体重/.test(key)) {
      return "weight";
    }
    if (/确认邮箱|再次输入邮箱/.test(key)) {
      return "confirmEmail";
    }
    if (/电子邮箱|邮箱|email|mail/.test(key)) {
      return "email";
    }
    if (/qq/.test(key)) {
      return "qq";
    }
    if (/紧急联系人手机|紧急联系人电话/.test(key)) {
      return "emergencyPhone";
    }
    if (/与紧急联系人关系|紧急联系人关系/.test(key)) {
      return "emergencyRelation";
    }
    if (/紧急联系人/.test(key)) {
      return "emergencyContact";
    }
    if (/证明人联系方式|证明人电话|证明人手机号/.test(key)) {
      return "referencePhone";
    }
    if (/证明人职位|证明人职务/.test(key)) {
      return "referenceRole";
    }
    if (/证明人姓名|证明人|推荐人/.test(key)) {
      return "referenceName";
    }
    if (/手机号码|手机号|手机|联系电话|电话号码/.test(key)) {
      return "phone";
    }
    if (/微信|wechat/.test(key)) {
      return "wechat";
    }
    if (/预计入职时间|可入职时间|到岗时间/.test(key)) {
      return "availableDate";
    }
    if (/简历名称|简历标题/.test(key)) {
      return "resumeTitle";
    }
    if (/有无工作经历|是否有工作经历/.test(key)) {
      return "workExperienceAvailable";
    }
    if (/离职原因|离开原因/.test(key)) {
      return "leavingReason";
    }
    if (/意向岗位|目标岗位|应聘岗位|申请岗位/.test(key)) {
      return "targetPosition";
    }
    if (/当前薪资|目前薪资|现薪资/.test(key)) {
      return "currentSalary";
    }
    if (/当前年收入|目前年收入|现年收入/.test(key)) {
      return "currentAnnualIncome";
    }
    if (/期望薪资|期望年薪|期望月薪|期望年收入/.test(key)) {
      return "expectedSalary";
    }
    if (/期望工作城市|意向工作城市|期望城市|意向城市/.test(key)) {
      return "expectedCity";
    }
    if (/面试城市|可面试城市/.test(key)) {
      return "interviewCity";
    }
    if (/当前居住地详细地址|现居住详细地址|现居住地址|居住地址|现住址|当前地址/.test(key)) {
      return "currentResidenceAddress";
    }
    if (/当前居住地|现居住地|现居住城市|居住城市|现居地/.test(key)) {
      return "currentResidenceCity";
    }
    if (/通讯地址|通信地址|联系地址|邮寄地址|收件地址/.test(key)) {
      return "mailingAddress";
    }
    if (/出生日期|出生年月|生日/.test(key)) {
      return "birthDate";
    }
    if (/开始时间|入学时间|开始日期/.test(key)) {
      return "startDate";
    }
    if (/结束时间|毕业时间|取得毕业证时间|截止时间/.test(key)) {
      return "endDate";
    }
    if (/培养方式|学习形式|教育类型/.test(key)) {
      return "trainingMode";
    }
    if (/学制|学习年限/.test(key)) {
      return "studyLength";
    }
    if (/学号|学生证号/.test(key)) {
      return "studentId";
    }
    if (/学校名称|毕业院校|院校名称/.test(key)) {
      return "school";
    }
    if (/院系|学院名称/.test(key)) {
      return "department";
    }
    if (/专业类型|专业名称|所学专业|专业$/.test(key)) {
      return "major";
    }
    if (/现工作单位|当前工作单位/.test(key)) {
      return "currentEmployer";
    }
    if (/工作单位|单位名称|公司名称|^公司$|实习单位/.test(key)) {
      return "employer";
    }
    if (/部门/.test(key)) {
      return "department";
    }
    if (/职务|岗位|职位名称/.test(key)) {
      return "role";
    }
    if (/籍贯省/.test(key)) {
      return "nativeProvince";
    }
    if (/籍贯市/.test(key)) {
      return "nativeCity";
    }
    if (/^籍贯$|籍贯所在地/.test(key)) {
      return "nativePlace";
    }
    if (/生源地省/.test(key)) {
      return "sourceProvince";
    }
    if (/生源地市/.test(key)) {
      return "sourceCity";
    }
    if (/^生源地$|生源所在地|生源户口/.test(key)) {
      return "sourcePlace";
    }
    if (/现户口所在地省|户口所在地省|户籍所在地省/.test(key)) {
      return "hukouProvince";
    }
    if (/现户口所在地市|户口所在地市|户籍所在地市/.test(key)) {
      return "hukouCity";
    }
    if (/现户口所在地|户口所在地|户籍所在地/.test(key)) {
      return "hukouPlace";
    }
    if (/工作实习地点省|工作地点省|实习地点省/.test(key)) {
      return "workProvince";
    }
    if (/工作实习地点市|工作地点市|实习地点市/.test(key)) {
      return "workCity";
    }
    if (/工作实习地点|工作地点|实习地点/.test(key)) {
      return "workPlace";
    }
    if (/高考所在地省/.test(key)) {
      return "examProvince";
    }
    if (/高考所在地市/.test(key)) {
      return "examCity";
    }
    if (/高考所在地|高考省份/.test(key)) {
      return "examPlace";
    }
    if (/平均学分成绩gpa|有无gpa|是否有gpa/.test(key) && !/分数|满分|评价体系/.test(key)) {
      return "gpaAvailable";
    }
    if (/gpa分数|绩点分数|平均学分成绩.*分数|请输入gpa分数数字/.test(key)) {
      return "gpaScore";
    }
    if (/gpa满分|绩点满分|4分制|5分制|评价体系/.test(key)) {
      return "gpaScale";
    }
    if (/班级排名|专业排名/.test(key) && /原因/.test(key)) {
      return "rankReason";
    }
    if (/班级排名/.test(key)) {
      return "classRank";
    }
    if (/专业排名/.test(key)) {
      return "majorRank";
    }
    if (/高考总分|总分数/.test(key)) {
      return "examTotal";
    }
    if (/高考科目|文理科/.test(key)) {
      return "examSubject";
    }
    if (/高考时间/.test(key)) {
      return "examDate";
    }
    if (/六级获得时间|六级获取日期|六级取得时间/.test(key)) {
      return "cet6Date";
    }
    if (/六级有效期/.test(key)) {
      return "cet6ValidUntil";
    }
    if (/六级分数/.test(key)) {
      return "cet6Score";
    }
    if (/^六级$|大学英语六级|cet6/.test(key)) {
      return "cet6Taken";
    }
    if (/四级获得时间|四级获取日期|四级取得时间/.test(key)) {
      return "cet4Date";
    }
    if (/四级有效期/.test(key)) {
      return "cet4ValidUntil";
    }
    if (/四级分数/.test(key)) {
      return "cet4Score";
    }
    if (/^四级$|大学英语四级|cet4/.test(key)) {
      return "cet4Taken";
    }
    if (/toefl.*分数|托福.*分数/.test(key)) {
      return "toeflScore";
    }
    if (/ielts.*分数|雅思.*分数/.test(key)) {
      return "ieltsScore";
    }
    if (/gre.*分数/.test(key)) {
      return "greScore";
    }
    if (/gmat.*分数/.test(key)) {
      return "gmatScore";
    }
    if (/^toefl$|托福/.test(key)) {
      return "toeflTaken";
    }
    if (/^ielts$|雅思/.test(key)) {
      return "ieltsTaken";
    }
    if (/^gre$/.test(key)) {
      return "greTaken";
    }
    if (/^gmat$/.test(key)) {
      return "gmatTaken";
    }
    if (/外语种类|外语语种|语言类型|语种/.test(key)) {
      return "languageType";
    }
    if (/证书名称技能名称|证书名称|技能名称/.test(key) && /外语|语言|英语|六级|四级|cet|toefl|ielts|gre|gmat/i.test(key)) {
      return "languageCertificate";
    }
    if (/掌握程度|熟练程度|语言水平|外语水平/.test(key)) {
      return "proficiency";
    }
    if (/听说能力|听说/.test(key)) {
      return "listeningSpeaking";
    }
    if (/读写能力|读写/.test(key)) {
      return "readingWriting";
    }
    if (/证书类别|证书类型|资格证书类别/.test(key)) {
      return "certificateCategory";
    }
    if (/证书编号|证书号码/.test(key)) {
      return "certificateNumber";
    }
    if (/证书获得时间|证书取得时间|获得时间|获取日期|取得时间/.test(key) && /证书|技能|外语|语言|英语|六级|四级|cet|toefl|ielts|gre|gmat/i.test(key)) {
      return "certificateDate";
    }
    if (/授予单位|颁发单位|发证机构|证书颁发单位/.test(key)) {
      return "certificateIssuer";
    }
    if (/证书说明|证书描述|证书备注/.test(key)) {
      return "certificateNote";
    }
    if (/考试分数|高考分数|分数/.test(key)) {
      return "examScore";
    }
    if (/项目名称|实践名称/.test(key)) {
      return "projectName";
    }
    if (/参与人数|团队人数|项目人数/.test(key)) {
      return "projectPeople";
    }
    if (/项目内容|项目描述/.test(key)) {
      return "projectDescription";
    }
    if (/本人职责|个人职责|职责/.test(key)) {
      return "responsibility";
    }
    if (/项目成果|实践成果|工作成果|实习成果/.test(key)) {
      return "result";
    }
    if (/项目链接|项目地址|作品链接/.test(key)) {
      return "projectUrl";
    }
    if (/工作内容描述|工作内容|实践内容|职责描述/.test(key)) {
      return "description";
    }
    if (/奖惩解除时间|处分解除时间|解除时间/.test(key)) {
      return "awardReleaseDate";
    }
    if (/奖惩时间|获奖时间|奖励时间/.test(key)) {
      return "awardDate";
    }
    if (/奖惩名称|奖励名称|奖项名称|荣誉名称/.test(key)) {
      return "awardName";
    }
    if (/颁奖单位|授奖单位|奖惩单位/.test(key)) {
      return "awardIssuer";
    }
    if (/奖励等级|奖项等级|奖励级别|奖惩层级/.test(key)) {
      return "awardLevel";
    }
    if (/奖惩描述|获奖描述|奖励描述|奖惩原因/.test(key)) {
      return "awardDescription";
    }
    if (/培训名称|培训项目/.test(key)) {
      return "trainingName";
    }
    if (/培训机构|培训单位/.test(key)) {
      return "trainingOrg";
    }
    if (/培训地点|培训城市|培训地址/.test(key)) {
      return "trainingPlace";
    }
    if (/培训课程/.test(key)) {
      return "trainingCourse";
    }
    if (/培训获得证书|培训证书/.test(key)) {
      return "trainingCertificate";
    }
    if (/培训内容|培训描述/.test(key)) {
      return "trainingDescription";
    }
    if (/刊物名称|期刊名称|发表刊物/.test(key)) {
      return "publication";
    }
    if (/刊物层级|期刊层级/.test(key)) {
      return "publicationLevel";
    }
    if (/论文名称|论文题目|文章名称/.test(key)) {
      return "paperName";
    }
    if (/论文描述|论文摘要|论文说明/.test(key)) {
      return "paperDescription";
    }
    if (/专利名称|专利题目/.test(key)) {
      return "patentName";
    }
    if (/专利编号|专利号/.test(key)) {
      return "patentNumber";
    }
    if (/专利类型/.test(key)) {
      return "patentType";
    }
    if (/专利成果|专利描述|专利说明/.test(key)) {
      return "patentResult";
    }
    if (/是否退休|有无退休/.test(key)) {
      return "retired";
    }
    if (/爱好及专长|特长爱好/.test(key)) {
      return "hobby";
    }
    if (/社会校园活动|社会活动|校园活动/.test(key)) {
      return "activity";
    }
    if (/受到奖励|学术成果|奖励学术成果/.test(key)) {
      return "achievement";
    }
    if (/自我评价|个人评价/.test(key)) {
      return "selfEvaluation";
    }
    if (/招聘信息来源|简历来源|信息来源/.test(key)) {
      return "source";
    }
    return "";
  }

  function getFirstSemanticBucket(parts, category = "") {
    for (const part of parts || []) {
      const bucket = getSemanticBucket(part, category);
      if (bucket) {
        return bucket;
      }
    }
    return "";
  }

  function getFieldSemanticBucket(field, fieldLabel, fieldCategory) {
    const contextualBucket = getContextualSemanticBucket(field, fieldLabel, fieldCategory);
    if (contextualBucket) {
      return contextualBucket;
    }

    return getFirstSemanticBucket(
      [
        fieldLabel,
        field?.label,
        field?.placeholder,
        field?.name,
        field?.id,
        field?.nearbyText,
        field?.groupText,
        getFieldOptionLabelsText(field, 180)
      ],
      fieldCategory
    );
  }

  function getEntrySemanticBucket(entry) {
    return getFirstSemanticBucket(
      [
        entry?.label,
        entry?.subsection,
        ...(entry?.aliases || [])
      ],
      entry?.category
    );
  }

  function canProjectEntryValueToFieldBucket(fieldBucket, entryBucket) {
    const projectionMap = {
      nativeProvince: ["nativePlace"],
      nativeCity: ["nativePlace"],
      sourceProvince: ["sourcePlace"],
      sourceCity: ["sourcePlace"],
      hukouProvince: ["hukouPlace"],
      hukouCity: ["hukouPlace"],
      workProvince: ["workPlace"],
      workCity: ["workPlace"],
      examProvince: ["examPlace"],
      examCity: ["examPlace"],
      currentResidenceCity: ["currentResidenceAddress"]
    };
    return (projectionMap[fieldBucket] || []).includes(entryBucket);
  }

  function splitAdministrativeLocation(value) {
    const text = normalizeText(value, 160).replace(/\s+/g, "");
    if (!text) {
      return [];
    }

    const parts =
      text.match(
        /(?:香港特别行政区|澳门特别行政区|北京市|上海市|天津市|重庆市|[^省]+省|[^自治区]+自治区|[^特别行政区]+特别行政区|[^市]+市|[^区县旗州盟]+(?:区|县|旗|州|盟))/g
      ) || [];

    return parts.map((part) => normalizeText(part, 40)).filter(Boolean);
  }

  function isMunicipalityLike(value) {
    return /^(北京市|上海市|天津市|重庆市|香港特别行政区|澳门特别行政区)$/.test(normalizeText(value, 40));
  }

  function getProvinceLevelLocationPart(parts) {
    const first = normalizeText(parts?.[0] || "", 40);
    if (!first) {
      return "";
    }
    return /省|自治区|特别行政区|市$/.test(first) ? first : "";
  }

  function getCityLevelLocationPart(parts) {
    const first = normalizeText(parts?.[0] || "", 40);
    const second = normalizeText(parts?.[1] || "", 40);
    if (!first) {
      return "";
    }
    if (isMunicipalityLike(first)) {
      return first;
    }
    if (/省|自治区|特别行政区/.test(first)) {
      return second || first;
    }
    if (/市$/.test(first)) {
      return first;
    }
    return second || first;
  }

  function projectAdministrativeLocationValue(value, fieldBucket) {
    const parts = splitAdministrativeLocation(value);
    if (parts.length === 0) {
      return "";
    }

    if (/Province$/.test(fieldBucket)) {
      return getProvinceLevelLocationPart(parts);
    }
    if (/City$/.test(fieldBucket) || fieldBucket === "currentResidenceCity") {
      return getCityLevelLocationPart(parts) || getProvinceLevelLocationPart(parts);
    }
    return "";
  }

  function areSemanticBucketsCompatible(fieldBucket, entryBucket) {
    if (!fieldBucket || !entryBucket) {
      return true;
    }
    return fieldBucket === entryBucket || canProjectEntryValueToFieldBucket(fieldBucket, entryBucket);
  }

  function resolveEntryValueForField(field, entry, fieldLabel, fieldCategory) {
    const rawValue = entry?.value == null ? "" : String(entry.value).trim();
    if (!rawValue) {
      return "";
    }

    const fieldBucket = getFieldSemanticBucket(field, fieldLabel, fieldCategory);
    const entryBucket = getEntrySemanticBucket(entry);
    if (fieldBucket === entryBucket || !canProjectEntryValueToFieldBucket(fieldBucket, entryBucket)) {
      return rawValue;
    }

    return projectAdministrativeLocationValue(rawValue, fieldBucket);
  }

  function getFamilyRelationFromText(value) {
    const text = compactText(value);
    if (!text) {
      return "";
    }
    if (/父亲|爸爸/.test(text)) {
      return "父亲";
    }
    if (/母亲|妈妈/.test(text)) {
      return "母亲";
    }
    if (/配偶|妻子|丈夫|爱人/.test(text)) {
      return "配偶";
    }
    if (/兄弟|姐妹|哥哥|姐姐|弟弟|妹妹/.test(text)) {
      return "兄弟姐妹";
    }
    if (/子女|儿子|女儿/.test(text)) {
      return "子女";
    }
    return "";
  }

  function getFieldFamilyRelation(field) {
    const textRelation = getFamilyRelationFromText([
      field?.nearbyText,
      field?.section,
      field?.groupText,
      field?.label,
      field?.placeholder
    ].join(" "));
    if (textRelation) {
      return textRelation;
    }

    const element = getElementByFieldRuntimeId(field);
    const siblingRelation = getNearbyLabeledControlValue(element, /关系|与本人关系|亲属关系/);
    return getFamilyRelationFromText(siblingRelation);
  }

  function getEntryFamilyRelation(entry) {
    return getFamilyRelationFromText([
      entry?.familyRelation,
      entry?.subsection,
      entry?.label,
      entry?.value,
      ...(entry?.aliases || [])
    ].join(" "));
  }

  function requiresFamilyRelationGate(fieldLabel) {
    return isFamilyMemberDetailLabel(fieldLabel) && !isFamilyRelationLabel(fieldLabel);
  }

  function isFamilyCandidateAllowed(field, entry, fieldLabel, fieldCategory) {
    if (!isFamilyScopedField(field, fieldLabel, fieldCategory)) {
      return true;
    }

    if (entry?.category !== "家庭信息") {
      return false;
    }

    if (!requiresFamilyRelationGate(fieldLabel)) {
      return true;
    }

    const fieldRelation = getFieldFamilyRelation(field);
    const entryRelation = getEntryFamilyRelation(entry);
    return Boolean(fieldRelation && entryRelation && fieldRelation === entryRelation);
  }

  function getFamilyRelationMatchBonus(field, entry, fieldCategory) {
    const fieldLabel = field?.inferredLabel || inferFieldLabel(field);
    if (!isFamilyScopedField(field, fieldLabel, fieldCategory)) {
      return 0;
    }

    if (entry?.category !== "家庭信息") {
      return -999;
    }

    if (!requiresFamilyRelationGate(fieldLabel)) {
      return 0;
    }

    const fieldRelation = getFieldFamilyRelation(field);
    const entryRelation = getEntryFamilyRelation(entry);
    if (!fieldRelation || !entryRelation) {
      return -999;
    }
    return fieldRelation === entryRelation ? 18 : -999;
  }

  function getElementByFieldRuntimeId(field) {
    if (!field?.fieldId) {
      return null;
    }
    try {
      return document.querySelector(`[${FIELD_ATTR}="${CSS.escape(field.fieldId)}"]`);
    } catch {
      return null;
    }
  }

  function getNearbyLabeledControlValue(element, labelPattern) {
    const root = findRepeatItemRoot(element);
    if (!root) {
      return "";
    }

    const controls = Array.from(root.querySelectorAll(CONTROL_SELECTOR))
      .filter((item, index, array) => array.indexOf(item) === index)
      .filter((item) => !item.closest(`#${PANEL_ID}`))
      .filter(isVisible);

    for (const control of controls) {
      if (control === element) {
        continue;
      }
      const container = findFieldContainer(control);
      const label = normalizeFieldLabelText(extractFieldContainerLabel(container) || getAdapterLabelText(control) || getNearbyText(control));
      if (labelPattern.test(label)) {
        const value = getControlCurrentValue(control);
        if (value) {
          return value;
        }
      }
    }

    return "";
  }

  function findRepeatItemRoot(element) {
    if (!element) {
      return null;
    }

    const { repeatItemSelector } = getAdapterSelectors();
    if (repeatItemSelector) {
      const adapterRoot = element.closest(repeatItemSelector);
      if (isRepeatItemRootCandidate(adapterRoot)) {
        return adapterRoot;
      }
    }

    let current = element.parentElement;
    let best = null;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      if (current.closest?.(`#${PANEL_ID}`)) {
        break;
      }

      const text = getTextWithoutControls(current);
      if (isRepeatItemRootCandidate(current)) {
        best = current;
      }
      if (/家庭|社会关系|亲属/.test(text) && isRepeatItemRootCandidate(current)) {
        return current;
      }
    }

    return best;
  }

  function isSemanticallyIncompatible(field, entry, fieldLabel, fieldCategory) {
    const fieldBucket = getFieldSemanticBucket(field, fieldLabel, fieldCategory);
    const entryBucket = getEntrySemanticBucket(entry);

    if (areSemanticBucketsCompatible(fieldBucket, entryBucket)) {
      return false;
    }

    return true;
  }

  function getEntryOccurrenceIndex(entry) {
    // Position inside the repeat section is authoritative; item titles such as "硕士" / "本科"
    // (from resume parsing) carry no number.
    const pathIndex = getEntryItemIndex(entry);
    if (pathIndex !== null) {
      return pathIndex + 1;
    }
    const text = normalizeText([entry?.subsection, entry?.category].filter(Boolean).join(" "), 120);
    const match = text.match(/(?:经历|信息|证书|奖惩|家庭|教育|工作\/实习|实习|项目|社团|学生工作)?\s*(\d+)/);
    if (!match) {
      return 0;
    }
    return Number(match[1]) || 0;
  }

  function getEntryItemIndex(entry) {
    const match = /\.items\[(\d+)\]/.exec(String(entry?.itemId || ""));
    return match ? Number(match[1]) : null;
  }

  function getEntrySectionKey(entry) {
    const match = /^profileV2\.sections\.([^.[\]]+)/.exec(String(entry?.itemId || ""));
    return match ? match[1] : "";
  }

  // Exact-label pass: a page label identical to a profile field label (directly, via the alias
  // table, or via a learned synonym row) is the strongest signal we have. It fills fields the
  // fuzzy scorer rejected and overrides fuzzy matches that picked a different field.
  function addExactLabelFallbackCandidates(plan) {
    const entries = Array.isArray(plan?.entries) ? plan.entries : [];
    const fields = Array.isArray(plan?.scan?.fields) ? plan.scan.fields : [];
    if (entries.length === 0 || fields.length === 0) {
      return plan;
    }

    let candidates = plan.candidates.slice();
    const byFieldId = new Map(candidates.map((candidate) => [candidate.fieldId, candidate]));
    let added = 0;
    let replaced = 0;

    for (const field of fields) {
      if (!field?.canFill) {
        continue;
      }
      const label = field.inferredLabel || inferFieldLabel(field);
      const key = normalizeMatchKey(label);
      if (!key || key.length < 2 || isGenericFieldLabel(label)) {
        continue;
      }
      const aliasHit = LEARNING_LABEL_ALIASES.find(([alias]) => normalizeMatchKey(alias) === key);
      const canonicalKey = normalizeMatchKey(aliasHit ? aliasHit[1] : label);
      const keys = new Set([key, canonicalKey]);

      const existing = byFieldId.get(field.fieldId) || null;
      if (existing && keys.has(normalizeMatchKey(existing.sourceLabel))) {
        continue; // already an exact match
      }

      const exactEntries = entries.filter((entry) => entry?.hasValue && keys.has(normalizeMatchKey(entry.label)) && getEntrySectionKey(entry));
      if (exactEntries.length === 0) {
        continue;
      }

      const sectionKeys = [...new Set(exactEntries.map(getEntrySectionKey))];
      const category = field.inferredCategory || inferMatchSection(field);
      const preferred = resolveLearningSectionForField({ ...field, inferredLabel: label, inferredCategory: category });
      const sectionKey = sectionKeys.includes(preferred) ? preferred : sectionKeys.length === 1 ? sectionKeys[0] : "";
      if (!sectionKey || sectionKey === "family") {
        continue; // ambiguous (姓名 lives in several sections) or family rows, which need relation logic
      }

      const matches = exactEntries
        .filter((entry) => getEntrySectionKey(entry) === sectionKey)
        .sort((left, right) => (getEntryItemIndex(left) ?? 0) - (getEntryItemIndex(right) ?? 0));
      let entry = matches[0];
      if (matches.length > 1) {
        const siblingIndex = findNearestCandidateItemIndex(field, candidates, sectionKey);
        entry = matches.find((item) => getEntryItemIndex(item) === siblingIndex) || entry;
      }

      const score = Math.max(60, Number(existing?.score || 0) + 1);
      const candidate = createAutofillCandidate({ ...field, inferredLabel: label, inferredCategory: category }, entry, score);
      if (!candidate.value) {
        continue;
      }
      candidate.reason = existing
        ? `字段名与本机资料字段一致，替换模糊匹配「${existing.sourceLabel}」`
        : "字段名与本机资料字段一致";
      if (existing) {
        candidates = candidates.filter((item) => item.id !== existing.id);
        replaced += 1;
      } else {
        added += 1;
      }
      candidates.push(candidate);
      byFieldId.set(field.fieldId, candidate);
    }

    if (added === 0 && replaced === 0) {
      return plan;
    }
    candidates.sort(compareAutofillCandidates);
    return {
      ...plan,
      candidates,
      exactLabelCount: added + replaced,
      autoFillIds: new Set(candidates.filter((candidate) => candidate.shouldAutoFill).map((candidate) => candidate.id))
    };
  }

  function findNearestCandidateItemIndex(field, candidates, sectionKey) {
    const element = findFieldElement(field);
    if (!element) {
      return null;
    }
    let best = null;
    let bestDepth = -9999;
    for (const candidate of candidates) {
      if (getEntrySectionKey({ itemId: candidate.sourceItemId }) !== sectionKey) {
        continue;
      }
      const itemIndex = getEntryItemIndex({ itemId: candidate.sourceItemId });
      if (itemIndex === null) {
        continue;
      }
      const sibling = findFieldElement(candidate.field);
      if (!sibling || sibling === element) {
        continue;
      }
      const depth = commonAncestorDepth(element, sibling);
      if (depth > bestDepth) {
        bestDepth = depth;
        best = itemIndex;
      }
    }
    return best;
  }

  // Highest ancestor of `element` that contains none of `others`: the repeat block the field
  // belongs to. Null when another field shares its immediate parent (synonyms in one block).
  function getRepeatBlockRoot(element, others) {
    let root = element;
    let current = element;
    while (current.parentElement && current.parentElement !== document.body && current.parentElement !== document.documentElement) {
      const parent = current.parentElement;
      if (others.some((other) => parent.contains(other))) {
        break;
      }
      root = parent;
      current = parent;
    }
    return root === element ? null : root;
  }

  // Repeat blocks are siblings of the same kind, each holding several controls.
  function blocksLookLikeRepeatItems(roots) {
    if (roots.length < 2) {
      return false;
    }
    const first = roots[0];
    return roots.every((root) => {
      const controls = Array.from(root.querySelectorAll(CONTROL_SELECTOR)).filter(isVisible);
      return root.parentElement === first.parentElement && root.tagName === first.tagName && controls.length >= 2;
    });
  }

  // For a control inside a repeat block, find the profile entry index used by the block's other
  // autofilled fields (nearest by DOM distance, so two education blocks do not bleed into each other).
  function findNearestSiblingItemIndex(element, sectionKey) {
    if (!element || !learningBaseline) {
      return null;
    }
    let best = null;
    let bestDepth = -1;
    for (const entry of learningBaseline.fields.values()) {
      const path = entry.filled && entry.candidate ? parseProfileItemPath(entry.candidate.sourceItemId) : null;
      if (!path || path.sectionKey !== sectionKey || path.itemIndex === null) {
        continue;
      }
      const sibling = findFieldElement(entry.field);
      if (!sibling || sibling === element) {
        continue;
      }
      const depth = commonAncestorDepth(element, sibling);
      if (depth > bestDepth) {
        bestDepth = depth;
        best = path.itemIndex;
      }
    }
    return best;
  }

  function commonAncestorDepth(left, right) {
    let depth = 0;
    for (let node = left; node; node = node.parentElement) {
      if (node.contains(right)) {
        return depth;
      }
      depth -= 1;
    }
    return -9999;
  }

  // Same-label fields that live in different repeat blocks on the page (教育经历 1 / 教育经历 2)
  // must draw from successive profile entries, not all from the first one.
  function alignRepeatSectionCandidates(plan) {
    const candidates = Array.isArray(plan?.candidates) ? plan.candidates : [];
    const entries = Array.isArray(plan?.entries) ? plan.entries : [];
    if (candidates.length < 2 || entries.length === 0) {
      return plan;
    }

    const domOrder = new Map((plan?.scan?.fields || []).map((field, index) => [field.fieldId, index]));
    const groups = new Map();
    for (const candidate of candidates) {
      const sectionKey = getEntrySectionKey({ itemId: candidate.sourceItemId });
      const itemIndex = getEntryItemIndex({ itemId: candidate.sourceItemId });
      if (!sectionKey || itemIndex === null || candidate.sourceCategory === "家庭信息") {
        continue;
      }
      const key = `${sectionKey}|${normalizeMatchKey(candidate.sourceLabel)}`;
      if (!groups.has(key)) {
        groups.set(key, { sectionKey, label: candidate.sourceLabel, items: [] });
      }
      groups.get(key).items.push(candidate);
    }

    const replacements = new Map();
    let realigned = 0;
    for (const group of groups.values()) {
      if (group.items.length < 2) {
        continue;
      }

      // Only distinct repeat blocks count; two synonyms inside one block must keep the same entry.
      const elements = group.items.map((candidate) => findFieldElement(candidate.field));
      const blocks = [];
      group.items.forEach((candidate, index) => {
        const element = elements[index];
        if (!element) {
          return;
        }
        const root = getRepeatBlockRoot(element, elements.filter((other, otherIndex) => other && otherIndex !== index));
        if (!root || blocks.some((block) => block.root === root)) {
          return;
        }
        blocks.push({ root, candidate, order: domOrder.get(candidate.fieldId) ?? 0 });
      });
      if (blocks.length < 2 || !blocksLookLikeRepeatItems(blocks.map((block) => block.root))) {
        continue;
      }
      blocks.sort((left, right) => left.order - right.order);

      const available = entries
        .filter((entry) => entry?.hasValue && entry.label === group.label && getEntrySectionKey(entry) === group.sectionKey)
        .sort((left, right) => getEntryItemIndex(left) - getEntryItemIndex(right));
      if (available.length < 2) {
        continue;
      }

      // Same label in every block: the block that scored best tells us how confident the
      // label match is, so realigned siblings inherit that score instead of a penalised one.
      const groupScore = Math.max(...group.items.map((candidate) => Number(candidate.score || 0)));
      blocks.forEach((block, position) => {
        const target = available[position];
        if (!target || target.itemId === block.candidate.sourceItemId) {
          return;
        }
        const original = block.candidate;
        const next = createAutofillCandidate(original.field, target, Math.max(groupScore, Number(original.score || 0)));
        next.confidence = Math.max(Number(original.confidence || 0), next.confidence);
        next.mappingSource = original.mappingSource;
        next.reason = [original.reason, `按页面第 ${position + 1} 段经历对齐到「${target.subsection || target.label}」`].filter(Boolean).join("；");
        replacements.set(original.id, next);
        realigned += 1;
      });
    }

    if (realigned === 0) {
      return plan;
    }

    const nextCandidates = candidates.map((candidate) => replacements.get(candidate.id) || candidate);
    return {
      ...plan,
      candidates: nextCandidates,
      realignedCount: realigned,
      autoFillIds: new Set(nextCandidates.filter((candidate) => candidate.shouldAutoFill).map((candidate) => candidate.id))
    };
  }

  function getOccurrenceMatchBonus(field, entry) {
    const fieldIndex = Number(field?.fieldOccurrenceIndex || 0);
    const fieldTotal = Number(field?.fieldOccurrenceTotal || 0);
    const entryIndex = getEntryOccurrenceIndex(entry);

    if (!fieldIndex || fieldTotal <= 1 || !entryIndex) {
      return 0;
    }

    return fieldIndex === entryIndex ? 18 : -14;
  }

  function buildCandidateLabels(fieldLabel, fieldCategory) {
    const labels = new Set();
    const normalized = normalizeText(fieldLabel, 120);
    if (normalized) {
      labels.add(normalized);
      labels.add(normalizeMatchKey(normalized));
    }

    const base = normalizeMatchKey(normalized);
    const add = (values) => {
      for (const value of values || []) {
        const text = normalizeText(value, 120);
        if (text) {
          labels.add(text);
          labels.add(normalizeMatchKey(text));
        }
      }
    };

    const mapped = [];
    for (const [key, aliases] of Object.entries(PROFILE_LABEL_ALIASES)) {
      if (normalizeMatchKey(key) === base || key === normalized) {
        mapped.push(key, ...aliases);
      }
    }
    add(mapped);

    return Array.from(labels).filter(Boolean);
  }

  function shouldUseRepeatGroupContext(field, fieldLabel, fieldCategory) {
    if (!field?.groupText) {
      return false;
    }

    const labelKey = normalizeMatchKey(fieldLabel || field?.label || "");
    if (!labelKey || isGenericFieldLabel(fieldLabel) || isOptionOnlyLabel(fieldLabel)) {
      return true;
    }

    if (["家庭信息", "绩效考核", "教育经历", "实习经历", "工作经历", "项目经历"].includes(fieldCategory)) {
      return true;
    }

    return /^(姓名|电话|手机号|联系方式|工作单位|单位名称|公司|职务|职位|岗位|地址|住址|联系地址|通讯地址|关系|联系人|证明人|推荐人|学校|专业|学历|学位|部门|地点|城市|开始时间|结束时间)$/.test(labelKey);
  }

  function scoreAutofillCandidate(field, entry, fieldLabel, fieldCategory) {
    if (!field || !entry) {
      return 0;
    }

    const familyScoped = isFamilyScopedField(field, fieldLabel, fieldCategory);
    if (familyScoped && entry.category !== "家庭信息") {
      return 0;
    }

    const optionText = getFieldOptionLabelsText(field, 180);
    const useGroupContext = shouldUseRepeatGroupContext(field, fieldLabel, fieldCategory);
    const fieldText = compactText([
      fieldLabel,
      field.nearbyText,
      field.placeholder,
      field.name,
      field.id,
      optionText,
      familyScoped || useGroupContext ? field.groupText : ""
    ].join(" "));
    const entryText = compactText([entry.label, entry.subsection, entry.category, ...(entry.aliases || [])].join(" "));
    if (!fieldText || !entryText) {
      return 0;
    }

    if (isExplanatoryField(fieldText) && !isExplanatoryEntry(entryText)) {
      return 0;
    }

    if (!isCategoryCompatibleForMapping(fieldCategory, entry.category)) {
      return 0;
    }

    if (isSemanticallyIncompatible(field, entry, fieldLabel, fieldCategory)) {
      return 0;
    }

    if (!isFamilyCandidateAllowed(field, entry, fieldLabel, fieldCategory)) {
      return 0;
    }

    const relationBonus = getFamilyRelationMatchBonus(field, entry, fieldCategory);
    if (relationBonus <= -999) {
      return 0;
    }

    const candidateLabels = buildCandidateLabels(fieldLabel, fieldCategory);
    let directScore = 0;

    directScore = Math.max(directScore, textMatchScore(fieldText, entry.label));
    directScore = Math.max(directScore, textMatchScore(fieldText, entry.subsection));
    directScore = Math.max(directScore, textMatchScore(fieldLabel, entry.label));
    directScore = Math.max(directScore, textMatchScore(fieldLabel, entry.subsection));

    for (const alias of entry.aliases || []) {
      directScore = Math.max(directScore, textMatchScore(fieldText, alias));
      directScore = Math.max(directScore, textMatchScore(fieldLabel, alias));
    }

    for (const candidateLabel of candidateLabels) {
      directScore = Math.max(directScore, textMatchScore(entryText, candidateLabel));
      directScore = Math.max(directScore, textMatchScore(entry.label, candidateLabel));
    }

    if (directScore <= 0) {
      return 0;
    }

    let score = directScore * 10;
    const fieldBucket = getFieldSemanticBucket(field, fieldLabel, fieldCategory);
    const entryBucket = getEntrySemanticBucket(entry);
    if (fieldBucket && entryBucket && fieldBucket === entryBucket) {
      score += 8;
    }
    score += relationBonus;
    score += textMatchScore(fieldText, entry.category) * 2;
    score += textMatchScore(fieldText, entry.subsection) * 8;

    if (fieldCategory === entry.category) {
      score += 4;
    } else {
      score += getEntryCategoryBonus(fieldCategory, entry.category);
    }

    score += getOccurrenceMatchBonus(field, entry);

    if (field.required) {
      score += 2;
    }

    if (field.hasCurrentValue) {
      score -= 5;
    }

    if (entry.hasValue) {
      score += 1;
    }

    if (/上传|附件|照片|证件照|简历附件/.test(fieldText)) {
      score = -999;
    }

    if (/是否|有无|能否|接受|服从/.test(fieldText) && entry.category === "有关声明") {
      score += 6;
    }

    if (/出生日期|出生年月|开始时间|结束时间|取得毕业证时间|获取日期|竞赛时间/.test(fieldText) && /日期|时间|年月/.test(entry.label)) {
      score += 5;
    }

    return score;
  }

  function guessAutofillValueFieldType(field) {
    const labelText = compactText([field?.inferredLabel || inferFieldLabel(field), field?.label, field?.placeholder].join(" "));
    const optionText = getFieldOptionLabelsText(field, 160);
    const contextText = compactText([field?.nearbyText, field?.section, field?.groupText, optionText].join(" "));
    if (/开始时间|结束时间|出生日期|出生年月|取得毕业证时间|获取日期|取得时间|竞赛时间|获得时间|有效期/.test(labelText)) {
      return "date";
    }
    if (/是否|有无|能否|接受|服从|未参加|参加过|长期有效|填写有效期/.test(labelText)) {
      return "choice";
    }
    if (/性别/.test(labelText)) {
      return "choice";
    }
    if (/男|女|是|否|有|无|未婚|已婚|离婚|丧偶|本科|硕士|博士|父亲|母亲|配偶|党员|团员|群众/.test(optionText)) {
      return "choice";
    }
    if (
      !labelText &&
      /开始时间|结束时间|出生日期|出生年月|取得毕业证时间|获取日期|取得时间|竞赛时间|获得时间|有效期/.test(contextText)
    ) {
      return "date";
    }
    if (
      !labelText &&
      /是否|有无|能否|接受|服从|未参加|参加过|长期有效|填写有效期|性别/.test(contextText)
    ) {
      return "choice";
    }
    if (/证书|语言|学历|学位|民族|政治面貌|生源地|居住地|地址|院校|院系|学校|单位|部门|职务|岗位/.test(labelText)) {
      return "text";
    }
    return "text";
  }

  function normalizeControlKind(currentType, aiKind) {
    const type = String(currentType || "").toLowerCase();
    const kind = String(aiKind || "").toLowerCase();

    if (!kind || kind === "unknown") {
      return type || "text";
    }

    if (["text", "textarea", "select", "search-select", "radio", "checkbox", "date", "file"].includes(kind)) {
      return kind === "search-select" ? "combobox" : kind;
    }

    if (kind.includes("select")) {
      return "select";
    }
    if (kind.includes("radio")) {
      return "radio";
    }
    if (kind.includes("checkbox")) {
      return "checkbox";
    }
    if (kind.includes("date")) {
      return "date";
    }
    if (kind.includes("search")) {
      return "combobox";
    }

    return type || "text";
  }

  function getAutoFillScoreThreshold(field, fieldLabel, fieldCategory) {
    if (isFamilyScopedField(field, fieldLabel, fieldCategory) && requiresFamilyRelationGate(fieldLabel)) {
      return field.hasCurrentValue ? 90 : 62;
    }
    return field.hasCurrentValue ? 84 : 55;
  }

  function createAutofillCandidate(field, entry, score) {
    const fieldLabel = field?.inferredLabel || inferFieldLabel(field);
    const fieldCategory = field?.inferredCategory || inferMatchSection(field);
    const value = resolveEntryValueForField(field, entry, fieldLabel, fieldCategory);
    const confidence = score >= 40 ? Math.max(0, Math.min(0.99, 0.45 + score / 100)) : Math.max(0, score / 120);
    const text = compactText([fieldLabel, fieldCategory, field.nearbyText, field.placeholder, field.name, field.id].join(" "));
    const writeMode = guessAutofillValueFieldType(field);
    const autoFillScoreThreshold = getAutoFillScoreThreshold(field, fieldLabel, fieldCategory);
    const alreadyMatches = valuesLookEquivalent(field.currentValue, value);
    const shouldAutoFill =
      (alreadyMatches || score >= autoFillScoreThreshold) &&
      value !== "" &&
      field.canFill &&
      !/上传|附件|照片|证件照|简历附件/.test(text);

    return {
      id: `candidate_${field.fieldId}`,
      fieldId: field.fieldId,
      field,
      fieldLabel,
      fieldCategory,
      sourceLabel: entry?.label || "",
      sourceCategory: entry?.category || "",
      sourceSubsection: entry?.subsection || "",
      sourceItemId: entry?.itemId || "",
      value,
      preview: formatCandidateValue(value, 140),
      confidence,
      writeMode,
      mappingSource: "本地规则",
      reason: "",
      shouldAutoFill,
      canAutoFill: Boolean(value) && field.canFill && (alreadyMatches || score >= 32),
      alreadyMatches,
      warning: buildCandidateWarning(field, entry, score, writeMode),
      score
    };
  }

  function createAiAutofillCandidate(mapping, scan, entries) {
    const field = getScanFieldById(scan, mapping?.fieldId);
    const entry = getProfileEntryByPath(entries, mapping?.sourcePath);
    if (!field || !entry?.hasValue) {
      return null;
    }

    const fieldLabel = field?.inferredLabel || inferFieldLabel(field);
    const fieldCategory = field?.inferredCategory || inferMatchSection(field);
    if (!isCategoryCompatibleForMapping(fieldCategory, entry.category)) {
      return null;
    }
    if (isSemanticallyIncompatible(field, entry, fieldLabel, fieldCategory)) {
      return null;
    }
    if (!isFamilyCandidateAllowed(field, entry, fieldLabel, fieldCategory)) {
      return null;
    }

    const confidence = Math.max(0, Math.min(1, Number(mapping.confidence || 0)));
    const score = Math.round(confidence * 100);
    const candidate = createAutofillCandidate(field, entry, Math.max(score, 35));
    if (!candidate.value) {
      return null;
    }
    candidate.confidence = confidence;
    candidate.score = score;
    candidate.mappingSource = "AI 优先匹配";
    candidate.reason = normalizeText(mapping.reason || "", 160);
    candidate.shouldAutoFill = (candidate.alreadyMatches || confidence >= (field.hasCurrentValue ? 0.86 : 0.68)) && Boolean(candidate.value) && field.canFill;
    candidate.canAutoFill = (candidate.alreadyMatches || confidence >= 0.42) && Boolean(candidate.value) && field.canFill;
    candidate.warning = buildAiCandidateWarning(candidate, mapping);
    return candidate;
  }

  function buildAiCandidateWarning(candidate, mapping) {
    const notes = [];
    if (candidate.field?.hasCurrentValue) {
      notes.push(candidate.shouldAutoFill ? "当前字段已有内容，自动填写时会覆盖" : "当前字段已有内容，已转为待处理");
    }
    if (candidate.writeMode !== "text") {
      notes.push(candidate.writeMode === "date" ? "日期字段需要核对格式" : "选择控件需要核对选项");
    }
    if (candidate.confidence < 0.68) {
      notes.push("AI 判断不够确定，已转为待处理");
    }
    if (mapping?.reason) {
      notes.push(`原因：${normalizeText(mapping.reason, 120)}`);
    }
    return notes.join("；");
  }

  function buildCandidateWarning(field, entry, score, writeMode) {
    const notes = [];
    if (!field.canFill) {
      notes.push("当前控件暂不支持自动填写");
    }
    if (field.hasCurrentValue) {
      notes.push(score >= 84 ? "当前字段已有内容，自动填写时会覆盖" : "当前字段已有内容，已转为待处理");
    }
    if (writeMode !== "text") {
      if (writeMode === "date") {
        notes.push("日期字段需要核对格式");
      } else {
        notes.push("可能需要手动点开选择，已转为待处理");
      }
    }
    if (score < 40) {
      notes.push("匹配不够确定，已转为待处理");
    }
    if (!entry?.hasValue) {
      notes.push("本地资料未填写");
    }
    return notes.join("；");
  }

  function formatCandidateValue(value, maxLength = 120) {
    if (value == null || value === "") {
      return "";
    }
    if (typeof value === "string") {
      return normalizeText(value, maxLength);
    }
    if (typeof value === "object") {
      try {
        return normalizeText(JSON.stringify(value), maxLength);
      } catch {
        return normalizeText(String(value), maxLength);
      }
    }
    return normalizeText(String(value), maxLength);
  }

  function normalizeComparableValue(value) {
    const text = normalizeText(value, 120);
    if (!text) {
      return "";
    }

    return normalizeChoiceLabel(normalizeDateValue(text))
      .replace(/大学本科/g, "本科")
      .replace(/学校级/g, "校级")
      .replace(/学院级/g, "院级")
      .replace(/离异/g, "离婚")
      .replace(/厘米|cm|CM|千克|公斤|kg|KG|万元|万/g, "");
  }

  function valuesLookEquivalent(left, right) {
    const normalizedLeft = normalizeComparableValue(left);
    const normalizedRight = normalizeComparableValue(right);
    if (!normalizedLeft || !normalizedRight) {
      return false;
    }
    return (
      normalizedLeft === normalizedRight ||
      normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft)
    );
  }

  function summarizeDebugField(field) {
    const label = field?.inferredLabel || inferFieldLabel(field);
    const category = field?.inferredCategory || inferMatchSection(field);
    return {
      fieldId: field?.fieldId || "",
      label: normalizeText(label || "", 120),
      category: normalizeText(category || "", 80),
      type: normalizeText(field?.type || "", 40),
      canFill: Boolean(field?.canFill),
      hasCurrentValue: Boolean(field?.hasCurrentValue),
      required: Boolean(field?.required),
      placeholder: normalizeText(field?.placeholder || "", 80),
      section: normalizeText(field?.section || "", 120),
      groupText: normalizeText(field?.groupText || "", 160)
    };
  }

  function summarizeDebugCandidate(candidate) {
    return {
      fieldId: candidate.fieldId,
      fieldLabel: normalizeText(candidate.fieldLabel || "", 120),
      fieldCategory: normalizeText(candidate.fieldCategory || "", 80),
      sourceLabel: normalizeText(candidate.sourceLabel || "", 120),
      sourceCategory: normalizeText(candidate.sourceCategory || "", 80),
      sourceSubsection: normalizeText(candidate.sourceSubsection || "", 120),
      score: Number(candidate.score || 0),
      confidence: Number(candidate.confidence || 0),
      writeMode: candidate.writeMode || "",
      mappingSource: candidate.mappingSource || "",
      shouldAutoFill: Boolean(candidate.shouldAutoFill),
      canAutoFill: Boolean(candidate.canAutoFill),
      alreadyMatches: Boolean(candidate.alreadyMatches),
      hasCurrentValue: Boolean(candidate.field?.hasCurrentValue),
      warning: normalizeText(candidate.warning || "", 180),
      reason: normalizeText(candidate.reason || "", 180)
    };
  }

  function summarizeDebugResult(result) {
    return {
      id: result?.id || "",
      ok: Boolean(result?.ok),
      note: normalizeText(result?.note || "", 180)
    };
  }

  function updateAutofillDebugPlan(plan, meta = {}) {
    if (!plan) {
      return;
    }

    const candidates = Array.isArray(plan.candidates) ? plan.candidates.map(summarizeDebugCandidate) : [];
    const fields = Array.isArray(plan.scan?.fields) ? plan.scan.fields.map(summarizeDebugField) : [];
    const autoFillCount = candidates.filter((candidate) => candidate.shouldAutoFill).length;
    const confirmCount = candidates.filter((candidate) => !candidate.shouldAutoFill && candidate.canAutoFill).length;
    const ignoredCount = Math.max(0, candidates.length - autoFillCount - confirmCount);
    const aiUsage = sanitizeAutofillAiUsage(meta.aiUsage || getAutofillAiSnapshot());

    lastAutofillDebug = {
      version: SCRIPT_VERSION,
      page: {
        url: plan.page?.url || location.href,
        title: plan.page?.title || document.title,
        hostname: plan.page?.hostname || location.hostname
      },
      generatedAt: new Date().toISOString(),
      mappingSource: plan.mappingSource || "",
      aiStatus: normalizeText(meta.aiStatus || aiUsage.message || "", 300),
      aiUsage,
      scan: {
        fieldCount: fields.length,
        expandedEditCards: Number(plan.scan?.expandedEditCards || 0),
        siteAdapter: plan.scan?.siteAdapter || null,
        fields
      },
      counts: {
        candidates: candidates.length,
        autoFill: autoFillCount,
        needsConfirm: confirmCount,
        ignored: ignoredCount
      },
      candidates,
      summary: null,
      results: []
    };
  }

  function updateAutofillDebugResults(summary, results) {
    if (!lastAutofillDebug) {
      lastAutofillDebug = {
        version: SCRIPT_VERSION,
        page: {
          url: location.href,
          title: document.title,
          hostname: location.hostname
        },
        generatedAt: new Date().toISOString(),
        counts: {},
        candidates: [],
        results: []
      };
    }

    lastAutofillDebug.summary = {
      attempted: Number(summary?.attempted || 0),
      filled: Number(summary?.filled || 0),
      failed: Number(summary?.failed || 0),
      skipped: Number(summary?.skipped || 0),
      pending: Number(summary?.pending ?? Number(summary?.failed || 0) + Number(summary?.skipped || 0)),
      total: Number(summary?.total || 0),
      message: normalizeText(summary?.message || "", 160),
      aiUsage: sanitizeAutofillAiUsage(summary?.aiUsage || getAutofillAiSnapshot())
    };
    lastAutofillDebug.aiUsage = sanitizeAutofillAiUsage(summary?.aiUsage || lastAutofillDebug.aiUsage || getAutofillAiSnapshot());
    lastAutofillDebug.aiStatus = lastAutofillDebug.aiUsage.message;
    lastAutofillDebug.results = Array.isArray(results) ? results.map(summarizeDebugResult) : [];
    lastAutofillDebug.finishedAt = new Date().toISOString();
  }

  function getAutofillCandidateSectionRank(category) {
    const index = AUTO_FILL_SECTION_ORDER.indexOf(category);
    return index === -1 ? 999 : index;
  }

  function compareAutofillCandidates(leftCandidate, rightCandidate) {
    const leftRank = getAutofillCandidateSectionRank(leftCandidate.fieldCategory);
    const rightRank = getAutofillCandidateSectionRank(rightCandidate.fieldCategory);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return Number(rightCandidate.score || 0) - Number(leftCandidate.score || 0);
  }

  function buildAutofillPlan(scan) {
    const entries = getCurrentProfileEntries();
    const visibleFields = Array.isArray(scan?.fields) ? scan.fields.filter((field) => field && field.canFill) : [];
    const fieldCounters = new Map();
    const fieldTotals = new Map();
    const enrichedFields = visibleFields.map((field) => {
      const fieldLabel = inferFieldLabel(field);
      const fieldCategory = inferMatchSection(field);
      const occurrenceKey = `${fieldCategory || "未分类"}|${normalizeMatchKey(fieldLabel) || field.fieldId}`;
      fieldTotals.set(occurrenceKey, (fieldTotals.get(occurrenceKey) || 0) + 1);
      return {
        ...field,
        inferredLabel: fieldLabel,
        inferredCategory: fieldCategory,
        occurrenceKey
      };
    });
    const candidates = [];

    for (const field of enrichedFields) {
      const fieldLabel = field.inferredLabel || inferFieldLabel(field);
      const fieldCategory = field.inferredCategory || inferMatchSection(field);
      const nextOccurrenceIndex = (fieldCounters.get(field.occurrenceKey) || 0) + 1;
      fieldCounters.set(field.occurrenceKey, nextOccurrenceIndex);
      field.fieldOccurrenceIndex = nextOccurrenceIndex;
      field.fieldOccurrenceTotal = fieldTotals.get(field.occurrenceKey) || 1;
      let bestEntry = null;
      let bestScore = -9999;

      for (const entry of entries) {
        if (!entry?.hasValue) {
          continue;
        }

        const score = scoreAutofillCandidate(field, entry, fieldLabel, fieldCategory);
        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
        }
      }

      if (!bestEntry || bestScore < 18) {
        continue;
      }

      const candidate = createAutofillCandidate(field, bestEntry, bestScore);
      if (!candidate.value) {
        continue;
      }
      candidates.push(candidate);
    }

    candidates.sort(compareAutofillCandidates);

    return {
      createdAt: new Date().toISOString(),
      mappingSource: "本地规则",
      page: {
        url: scan?.url || "",
        title: scan?.title || "",
        hostname: scan?.hostname || ""
      },
      scan,
      entries,
      candidates,
      autoFillIds: new Set(candidates.filter((candidate) => candidate.shouldAutoFill).map((candidate) => candidate.id))
    };
  }

  function sortAutofillCandidates(candidates) {
    return candidates.slice().sort(compareAutofillCandidates);
  }

  function cloneLocalFallbackCandidate(candidate) {
    return {
      ...candidate,
      mappingSource: "本地规则兜底"
    };
  }

  function shouldFallbackToLocalCandidate(aiCandidate, localCandidate) {
    if (!aiCandidate || !localCandidate) {
      return false;
    }
    if (aiCandidate.shouldAutoFill) {
      return false;
    }
    if (aiCandidate.confidence >= 0.58) {
      return false;
    }
    if (localCandidate.shouldAutoFill && localCandidate.score >= 55) {
      return true;
    }
    if (!aiCandidate.canAutoFill && localCandidate.canAutoFill && localCandidate.score >= 45) {
      return true;
    }
    return false;
  }

  function buildAiFirstPlan(localPlan, aiCandidates, notes = []) {
    if (!localPlan || !Array.isArray(aiCandidates) || aiCandidates.length === 0) {
      return localPlan;
    }

    const selectedByFieldId = new Map();
    const localByFieldId = new Map((localPlan.candidates || []).map((candidate) => [candidate.fieldId, candidate]));
    let aiPrimaryCount = 0;
    let localFallbackCount = 0;

    for (const aiCandidate of aiCandidates) {
      const localCandidate = localByFieldId.get(aiCandidate.fieldId);
      if (shouldFallbackToLocalCandidate(aiCandidate, localCandidate)) {
        selectedByFieldId.set(aiCandidate.fieldId, cloneLocalFallbackCandidate(localCandidate));
        localFallbackCount += 1;
        continue;
      }
      selectedByFieldId.set(aiCandidate.fieldId, aiCandidate);
      aiPrimaryCount += 1;
    }

    for (const localCandidate of localPlan.candidates || []) {
      if (selectedByFieldId.has(localCandidate.fieldId)) {
        continue;
      }
      selectedByFieldId.set(localCandidate.fieldId, cloneLocalFallbackCandidate(localCandidate));
      localFallbackCount += 1;
    }

    const candidates = sortAutofillCandidates(Array.from(selectedByFieldId.values()));
    return {
      ...localPlan,
      mappingSource: localFallbackCount > 0 ? "AI 优先 + 本地规则兜底" : "AI 优先匹配",
      aiNotes: notes,
      aiPrimaryCount,
      localFallbackCount,
      candidates,
      autoFillIds: new Set(candidates.filter((candidate) => candidate.shouldAutoFill).map((candidate) => candidate.id))
    };
  }

  function buildPlanMatchSummary(plan) {
    const aiPrimaryCount = Number(plan?.aiPrimaryCount || 0);
    const localFallbackCount = Number(plan?.localFallbackCount || 0);
    if (plan?.mappingSource === "AI 优先 + 本地规则兜底") {
      return `AI 优先匹配 ${aiPrimaryCount} 项，本地规则兜底 ${localFallbackCount} 项`;
    }
    if (plan?.mappingSource === "AI 优先匹配") {
      return `AI 优先匹配 ${aiPrimaryCount} 项`;
    }
    if (plan?.mappingSource === "AI 表单字段识别 + 本地规则") {
      return "AI 已识别表单结构，本地规则完成字段匹配";
    }
    return "本地规则完成字段匹配";
  }

  async function enhancePlanWithAi(scan, localPlan) {
    const entries = Array.isArray(localPlan?.entries) ? localPlan.entries : getCurrentProfileEntries();
    const profileCatalog = buildProfileCatalogFromEntries(entries);
    if (profileCatalog.fields.length === 0) {
      return { plan: localPlan };
    }

    setAutofillAiTrying("字段理解");
    setAutofillProgress("AI 匹配字段", 76, "正在用 AI 优先匹配页面字段，本地规则会兜底剩余字段");
    setProfilePanelStatus("正在用 AI 优先匹配页面字段，只发送字段名称，不发送资料值...");
    const response = await sendRuntimeMessage({
      type: "OJAF_MAP_FIELDS",
      payload: {
        scan,
        profileCatalog
      }
    });

    const mappings = Array.isArray(response?.mappings) ? response.mappings : [];
    const aiCandidates = mappings
      .map((mapping) => createAiAutofillCandidate(mapping, scan, entries))
      .filter(Boolean);
    if (aiCandidates.length === 0) {
      setAutofillAiNoResult("字段理解", "AI 未返回可用字段匹配");
      setAutofillProgress("本地兜底匹配", 82, "AI 未返回可用匹配，正在切换本地规则兜底");
      return {
        plan: localPlan
      };
    }

    const enhancedPlan = buildAiFirstPlan(localPlan, aiCandidates, response?.notes || []);
    setAutofillAiUsed("字段理解");
    setAutofillProgress("AI 匹配字段", 86, buildPlanMatchSummary(enhancedPlan));

    return {
      plan: enhancedPlan
    };
  }

  async function enhanceScanWithAi(scan) {
    try {
      setAutofillAiTrying("表单字段识别");
      setAutofillProgress("AI 识别表单字段", 50, "正在识别字段名称和控件类型");
      setProfilePanelStatus("正在用 AI 识别表单结构，只发送字段信息...");
      const response = await sendRuntimeMessage({
        type: "OJAF_ANALYZE_PAGE_STRUCTURE",
        payload: {
          scan
        }
      });

      const hints = Array.isArray(response?.fieldHints) ? response.fieldHints : [];
      if (hints.length === 0) {
        setAutofillAiNoResult("表单字段识别", "AI 未返回可用字段建议");
        setAutofillProgress("整理表单字段", 60, "AI 没有提供可用建议，继续使用本地规则兜底");
        return { scan };
      }

      const fieldMap = new Map((scan.fields || []).map((field) => [field.fieldId, field]));
      for (const hint of hints) {
        const field = fieldMap.get(hint.fieldId);
        if (!field) {
          continue;
        }
        if (hint.label && (!field.label || field.label.length < 2 || (hint.confidence >= 0.68 && hint.label.length < field.label.length))) {
          field.label = hint.label;
        }
        if (hint.section && (!field.section || field.section.length < 2 || (hint.confidence >= 0.68 && hint.section.length < field.section.length))) {
          field.section = hint.section;
        }
        if (hint.controlKind && hint.controlKind !== "unknown") {
          field.type = normalizeControlKind(field.type, hint.controlKind);
        }
        field.aiHint = {
          confidence: hint.confidence,
          note: hint.note
        };
      }

      setAutofillAiUsed("表单字段识别");
      setAutofillProgress("AI 识别表单字段", 60, `已识别 ${hints.length} 项`);

      return {
        scan: {
          ...scan,
          fields: Array.from(fieldMap.values()),
          aiStructure: {
            siteType: response.siteType || "generic",
            confidence: response.confidence || 0,
            notes: response.notes || []
          }
        }
      };
    } catch (error) {
      setAutofillAiFallback("表单字段识别", error);
      setAutofillProgress("整理表单字段", 58, "AI 不可用，已使用本地规则继续");
      setProfilePanelStatus("AI 不可用，已使用本地规则继续识别表单字段。");
      return {
        scan
      };
    }
  }

  async function generateAutofillPlan(options = {}) {
    const ownsRun = !options.continueRun;
    let runId = Number(options.runId || 0);

    if (ownsRun) {
      runId = startAutofillRun("扫描页面并准备填写");
      if (!runId) {
        setProfilePanelStatus("当前已有扫描任务在运行，请稍候。", true);
        return { ok: false, reason: "busy" };
      }
    } else if (!isCurrentAutofillRun(runId)) {
      return { ok: false, reason: "busy" };
    }

    try {
      setAutofillProgress("读取本机资料", 8, "本地读取简历资料");
      await refreshCurrentProfile({ force: true });
      setAutofillProgress("扫描当前页面", 24, "本地扫描页面字段并展开可编辑区域");
      setProfilePanelStatus("正在本地扫描当前页面并准备自动填写...");
      const baseScan = await scanForm();
      setAutofillProgress("整理表单字段", 42, `本地已发现 ${baseScan.fields.length} 个可见字段`);
      const aiStructure = await enhanceScanWithAi(baseScan);
      const scan = aiStructure.scan || baseScan;
      const localPlan = addExactLabelFallbackCandidates(buildAutofillPlan(scan));
      let plan = localPlan;

      try {
        const aiResult = await enhancePlanWithAi(scan, localPlan);
        plan = aiResult.plan || plan;
      } catch (error) {
        setAutofillAiFallback("字段理解", error);
        setAutofillProgress("本地兜底匹配", 84, `AI 不可用，正在用本地规则兜底 ${scan.fields.length} 个字段`);
      }

      plan = alignRepeatSectionCandidates(plan);

      if (plan.mappingSource === "本地规则" && (autofillAiState.usedPhases || []).includes("表单字段识别")) {
        plan = {
          ...plan,
          mappingSource: "AI 表单字段识别 + 本地规则"
        };
      }

      const aiUsage = getAutofillAiSnapshot();
      const aiStatus = aiUsage.message;
      setAutofillProgress("整理匹配结果", 90, `${buildPlanMatchSummary(plan)}，共匹配 ${plan.candidates.length} 项`);
      updateAutofillDebugPlan(plan, { aiStatus, aiUsage });

      const autoFillCount = plan.autoFillIds.size;
      setProfilePanelStatus(
        plan.candidates.length > 0
          ? `${aiStatus} ${buildPlanMatchSummary(plan)}，共匹配 ${plan.candidates.length} 项，将自动填写 ${autoFillCount} 项。`
          : `${aiStatus} 没有找到可自动匹配的字段。`
      );
      setAutofillProgress("匹配完成", 90, `${buildPlanMatchSummary(plan)}，准备自动填写当前网页`);
      return {
        ok: true,
        plan,
        aiStatus,
        aiUsage,
        aiUsed: aiUsage.used,
        aiFallbackReason: aiUsage.fallbackReason,
        autoFillCount
      };
    } catch (error) {
      renderProfilePanel();
      setProfilePanelStatus(`准备填写失败：${error.message}`, true);
      return { ok: false, reason: error.message };
    } finally {
      if (ownsRun) {
        clearAutofillProgress();
      }
    }
  }

  async function runOneClickAutofill() {
    const runId = startAutofillRun("开始填写");
    if (!runId) {
      setProfilePanelStatus("当前已有填写任务在运行，请稍候。", true);
      return { ok: false, reason: "busy" };
    }

    try {
      clearMarks();
      setProfilePanelStatus("正在扫描页面并准备一键填写...");
      const planResult = await generateAutofillPlan({ runId, continueRun: true });
      if (!planResult?.ok) {
        return planResult || { ok: false, reason: "plan failed" };
      }

      const plan = planResult.plan;
      const aiUsage = sanitizeAutofillAiUsage(planResult.aiUsage || getAutofillAiSnapshot());
      const autoFillIds = plan?.autoFillIds instanceof Set
        ? plan.autoFillIds
        : new Set(Array.isArray(plan?.autoFillIds) ? plan.autoFillIds : []);

      if (!plan || autoFillIds.size === 0) {
        setProfilePanelStatus("本页没有自动填写项，橙色字段需要手动处理。可以打开资料面板查看和复制资料。", true);
        const skippedCount = await markDeferredPlanCandidates(plan, autoFillIds);
        const missingCount = await markMissingProfileFields(plan);
        const summary = {
          attempted: 0,
          filled: 0,
          failed: 0,
          skipped: skippedCount || plan?.candidates?.length || 0,
          missing: missingCount,
          total: plan?.candidates?.length || 0,
          message: missingCount > 0
            ? "没有找到可自动填写的字段。橙色为待处理，橙色虚线为资料库中没有的字段，都需要手动处理。"
            : "没有找到可自动填写的字段，橙色标记需要手动处理。",
          aiUsage
        };
        setAutofillSummary(summary);
        updateAutofillDebugResults(summary, []);
        setupLearningBaseline(plan, []);
        return {
          ok: false,
          reason: "no candidates",
          aiUsage,
          aiUsed: aiUsage.used,
          aiFallbackReason: aiUsage.fallbackReason
        };
      }

      setAutofillProgress("填写匹配项", 94, `本地准备填写 ${autoFillIds.size} 项`);
      const beforeCount = autoFillIds.size;
      const fillResult = await applyAutofillPlan(plan, autoFillIds, { runId });
      setupLearningBaseline(plan, fillResult?.results || []);
      if (profilePanelVisible) {
        renderProfilePanel();
      }
      if (!fillResult?.ok) {
        return fillResult || { ok: false, reason: "fill failed" };
      }
      return {
        ok: true,
        autoFilled: beforeCount,
        filled: fillResult.filled || 0,
        failed: fillResult.failed || 0,
        skipped: fillResult.skipped || 0,
        missing: fillResult.missing || 0,
        total: fillResult.total || 0,
        aiUsage,
        aiUsed: aiUsage.used,
        aiFallbackReason: aiUsage.fallbackReason
      };
    } catch (error) {
      setProfilePanelStatus(`一键填写失败：${error.message}`, true);
      throw error;
    } finally {
      clearAutofillProgress();
    }
  }

  async function applyAutofillPlan(plan, autoFillIds, options = {}) {
    const runId = Number(options.runId || 0);
    if (autofillInProgress && !isCurrentAutofillRun(runId)) {
      setProfilePanelStatus("当前正在处理其他填写任务，请稍候。", true);
      return { ok: false, reason: "busy" };
    }

    const autoFillSet = autoFillIds instanceof Set ? autoFillIds : new Set(autoFillIds || []);
    if (!plan || autoFillSet.size === 0) {
      setProfilePanelStatus("没有找到可自动填写的匹配项。", true);
      return { ok: false, reason: "no autofill candidates" };
    }

    const autoFillCandidates = plan.candidates.filter((candidate) => autoFillSet.has(candidate.id));
    if (autoFillCandidates.length === 0) {
      setProfilePanelStatus("没有找到可自动填写项。", true);
      return { ok: false, reason: "empty autofill candidates" };
    }

    setProfilePanelStatus("正在把匹配项填写到当前网页...");
    if (isCurrentAutofillRun(runId)) {
      setAutofillProgress("填写匹配项", 94, `本地准备填写 ${autoFillCandidates.length} 项`);
    }
    const results = [];

    for (let index = 0; index < autoFillCandidates.length; index += 1) {
      const candidate = autoFillCandidates[index];
      const field = candidate.field;
      let element = await resolveFieldElement(field);
      let ok = false;
      let note = "";

      if (element) {
        if (candidate.alreadyMatches) {
          ok = true;
          note = "当前值已匹配本机资料";
        } else {
          const fillResult = await fillElementSmart(element, candidate.value, field, candidate);
          ok = Boolean(fillResult?.ok);
          note = fillResult?.reason || fillResult?.warning || "";
        }
      } else {
        note = "未找到可自动填写控件";
      }

      if (element) {
        markElement(element, ok ? "filled" : "uncertain", `${ok ? "自动填写" : "待处理"}: ${candidate.fieldLabel || candidate.sourceLabel || candidate.id}`);
      }

      if (isCurrentAutofillRun(runId)) {
        const percent = 94 + Math.round(((index + 1) / autoFillCandidates.length) * 6);
        setAutofillProgress("填写匹配项", percent, `本地已处理 ${index + 1}/${autoFillCandidates.length} 项`);
      }

      results.push({
        id: candidate.id,
        ok,
        note
      });
    }

    const filledCount = results.filter((result) => result.ok).length;
    const failedCount = results.length - filledCount;
    const skippedCount = await markDeferredPlanCandidates(plan, autoFillSet);
    const missingCount = await markMissingProfileFields(plan);
    const summary = {
      attempted: results.length,
      filled: filledCount,
      failed: failedCount,
      skipped: skippedCount,
      pending: failedCount + skippedCount,
      missing: missingCount,
      total: plan?.candidates?.length || results.length,
      message: buildAutofillSummaryMessage(missingCount),
      aiUsage: getAutofillAiSnapshot()
    };
    setProfilePanelStatus(`已自动填写 ${filledCount} 项，待处理 ${summary.pending} 项${missingCount > 0 ? `，资料库中没有的字段 ${missingCount} 项` : ""}。`);
    setAutofillSummary(summary);
    updateAutofillDebugResults(summary, results);
    await persistProfilePanelState(getProfilePanelStateSnapshot());
    return {
      ok: true,
      attempted: results.length,
      filled: filledCount,
      failed: failedCount,
      skipped: skippedCount,
      missing: missingCount,
      total: plan?.candidates?.length || results.length,
      aiUsage: summary.aiUsage,
      results
    };
  }

  function buildAutofillSummaryMessage(missingCount) {
    return missingCount > 0
      ? "页面已标记：绿色为已填写，橙色为待处理，橙色虚线为资料库中没有的字段（填写后可通过“更新资料库”写回）。"
      : "页面已标记：绿色为已填写，橙色为待处理。";
  }

  // Fillable, labeled controls that matched nothing in the local profile: the user must fill
  // them by hand, and once filled they show up as 新增 in the learning panel.
  function isMissingProfileFieldCandidate(field) {
    if (!field?.canFill || field.hasCurrentValue) {
      return false;
    }
    if (["file", "hidden", "submit", "button", "image", "reset", "checkbox", "radio", "password", "search"].includes(field.type)) {
      return false;
    }
    const label = field.inferredLabel || inferFieldLabel(field);
    if (!label || isGenericFieldLabel(label)) {
      return false;
    }
    const text = compactText([label, field.placeholder, field.name, field.id].join(" "));
    return !/验证码|captcha|搜索|search|密码|password|上传|附件|照片/i.test(text);
  }

  async function markMissingProfileFields(plan) {
    const fields = Array.isArray(plan?.scan?.fields) ? plan.scan.fields : [];
    const matchedIds = new Set((plan?.candidates || []).map((candidate) => candidate.fieldId));
    let count = 0;
    for (const field of fields) {
      if (matchedIds.has(field.fieldId) || !isMissingProfileFieldCandidate(field)) {
        continue;
      }
      const element = findFieldElement(field);
      if (!element || element.getAttribute(MARK_ATTR)) {
        continue;
      }
      const label = field.inferredLabel || inferFieldLabel(field);
      markElement(element, "missing", `资料库中没有此字段: ${label}。手动填写后可通过“更新资料库”写回本机资料。`);
      count += 1;
      if (count % 12 === 0) {
        await sleep(0);
      }
    }
    return count;
  }

  async function markDeferredPlanCandidates(plan, autoFillIds) {
    if (!plan || !Array.isArray(plan.candidates)) {
      return 0;
    }

    const autoFillSet = autoFillIds instanceof Set ? autoFillIds : new Set(autoFillIds || []);
    let count = 0;
    for (const candidate of plan.candidates) {
      if (autoFillSet.has(candidate.id)) {
        continue;
      }
      if (!candidate.canAutoFill) {
        continue;
      }
      const element = findFieldElement(candidate.field);
      if (!element) {
        continue;
      }
      markElement(element, "uncertain", `待处理: ${candidate.fieldLabel || candidate.sourceLabel || candidate.id}`);
      count += 1;
      if (count % 12 === 0) {
        await sleep(0);
      }
    }
    return count;
  }

  let currentFillCandidate = null;

  async function fillElementSmart(element, value, field, candidate) {
    if (!element) {
      return { ok: false, reason: "field not found" };
    }
    currentFillCandidate = candidate || null;

    const type = getControlType(element);
    if (element.disabled || element.getAttribute("aria-disabled") === "true") {
      return { ok: false, reason: "field disabled" };
    }

    if (type === "file") {
      return { ok: false, reason: "file upload requires manual selection" };
    }

    const editableTarget = resolveEditableTarget(element);
    if (editableTarget && editableTarget !== element) {
      element = editableTarget;
    }

    const text = compactText([candidate?.fieldLabel, field?.nearbyText, field?.placeholder, field?.name, field?.id, field?.section].join(" "));
    const isChoiceField = candidate?.writeMode === "choice" || /选择|请选择|下拉|选择项|单选/.test(text);

    if (candidate?.writeMode === "date") {
      setNativeValue(element, normalizeDateValue(value));
      return { ok: true };
    }

    if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) {
      return fillBooleanOrRadioChoice(element, value, field, candidate);
    }

    if (element.getAttribute("role") === "radio" || element.getAttribute("role") === "checkbox") {
      return fillRoleChoice(element, value, field, candidate);
    }

    if (type === "combobox") {
      const choiceResult = await tryFillCustomChoiceField(element, value, field);
      if (choiceResult.ok) {
        return choiceResult;
      }

      const textInput = element.querySelector?.('input:not([type="hidden"]),textarea,[contenteditable="true"]');
      if (textInput && textInput !== element) {
        setNativeValue(textInput, value);
        return { ok: true, warning: "combobox fallback wrote into inner input only" };
      }
    }

    if (element instanceof HTMLSelectElement) {
      const matched = setSelectValue(element, value);
      if (matched) {
        return { ok: true };
      }
      const picked = await aiPickOption(field, candidate, value, Array.from(element.options).map((option) => option.textContent));
      if (picked && setSelectValue(element, picked.option)) {
        return { ok: true, warning: `AI 选项匹配：${picked.option}`, aiMatched: true };
      }
      return { ok: true, warning: "下拉选项需要手动确认，已尝试按原值填写" };
    }

    if (element.isContentEditable) {
      setContentEditableValue(element, value);
      return { ok: true };
    }

    if (isChoiceField) {
      const choiceResult = await tryFillCustomChoiceField(element, value, field);
      if (choiceResult.ok) {
        return choiceResult;
      }
    }

    element.focus();
    setNativeValue(element, value);
    return { ok: true };
  }

  function resolveEditableTarget(element) {
    if (!element || !(element instanceof Element)) {
      return null;
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element.isContentEditable
    ) {
      return element;
    }

    const role = element.getAttribute("role");
    if (role === "radio" || role === "checkbox") {
      return element;
    }

    const input = element.querySelector?.('input:not([type="hidden"]),textarea,[contenteditable="true"]');
    return input || element;
  }

  function fillRoleChoice(element, value, field, candidate) {
    const role = element.getAttribute("role");
    const target = normalizeChoiceValue(value, candidate?.fieldLabel || field?.label || "");
    const root = findChoiceFieldContainer(element);
    const options = Array.from(root.querySelectorAll('[role="radio"],[role="checkbox"],label,button,[class*="radio"],[class*="checkbox"]'));
    const matched = options.find((option) => {
      const text = getElementText(option);
      return choiceTextMatches(text, target) || choiceTextMatches(option.getAttribute("aria-label") || "", target);
    });

    if (matched) {
      clickActionElement(matched);
      return { ok: true };
    }

    if (role === "checkbox" && /^(是|yes|true|1|on)$/i.test(target)) {
      clickActionElement(element);
      return { ok: true };
    }

    if (role === "radio") {
      clickActionElement(element);
      return { ok: true };
    }

    return { ok: false, reason: "no matching role choice found" };
  }

  function fillBooleanOrRadioChoice(element, value, field, candidate) {
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      setCheckboxOrRadio(element, value);
      return { ok: true };
    }

    if (!(element instanceof HTMLInputElement) || element.type !== "radio") {
      return { ok: false, reason: "unsupported choice field" };
    }

    const target = normalizeChoiceValue(value, candidate?.fieldLabel || field?.label || "");
    const group = element.name
      ? Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(element.name)}"]`))
      : [element];
    let matched = null;

    for (const radio of group) {
      const radioLabel = normalizeChoiceLabel(getChoiceLabelText(radio));
      if (radioLabel && choiceTextMatches(radioLabel, target)) {
        matched = radio;
        break;
      }
    }

    if (!matched) {
      matched = group.find((radio) => String(radio.value || "").trim() === target || choiceTextMatches(radio.value || "", target)) || null;
    }

    if (!matched) {
      return aiPickRadio(group, value, field, candidate);
    }

    matched.click();
    matched.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }

  async function aiPickRadio(group, value, field, candidate) {
    const labels = group.map((radio) => normalizeText(getChoiceLabelText(radio), 120));
    const picked = await aiPickOption(field, candidate, value, labels);
    const index = picked ? labels.indexOf(picked.option) : -1;
    if (index < 0) {
      return { ok: false, reason: "no matching radio option" };
    }
    group[index].click();
    group[index].dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, warning: `AI 选项匹配：${picked.option}`, aiMatched: true };
  }

  function getChoiceLabelText(element) {
    if (!element) {
      return "";
    }

    const parent = element.closest("label") || element.parentElement;
    const siblings = [];
    if (parent) {
      siblings.push(getElementText(parent));
      if (parent.nextElementSibling) {
        siblings.push(getElementText(parent.nextElementSibling));
      }
      if (parent.previousElementSibling) {
        siblings.push(getElementText(parent.previousElementSibling));
      }
    }

    return normalizeText(siblings.filter(Boolean).join(" "), 120);
  }

  function normalizeChoiceLabel(value) {
    return normalizeMatchKey(value)
      .replace(/大学本科/g, "本科")
      .replace(/学校级/g, "校级")
      .replace(/学院级/g, "院级")
      .replace(/离异/g, "离婚");
  }

  function normalizeChoiceValue(value, fallback = "") {
    const text = normalizeText(value == null ? fallback : value, 80);
    if (!text) {
      return "";
    }
    if (/^(是|yes|true|1|on)$/i.test(text)) {
      return "是";
    }
    if (/^(否|no|false|0|off)$/i.test(text)) {
      return "否";
    }
    return text;
  }

  function normalizeDateValue(value) {
    const text = normalizeText(value, 80);
    if (!text) {
      return "";
    }

    const yearMonthDay = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (yearMonthDay) {
      const [, year, month, day] = yearMonthDay;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    const yearMonth = text.match(/(\d{4})[./-](\d{1,2})/);
    if (yearMonth) {
      const [, year, month] = yearMonth;
      return `${year}-${String(month).padStart(2, "0")}`;
    }

    const chineseYearMonthDay = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
    if (chineseYearMonthDay) {
      const [, year, month, day] = chineseYearMonthDay;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    const chineseYearMonth = text.match(/(\d{4})年(\d{1,2})月/);
    if (chineseYearMonth) {
      const [, year, month] = chineseYearMonth;
      return `${year}-${String(month).padStart(2, "0")}`;
    }

    return text;
  }

  function choiceTextMatches(label, target) {
    const left = normalizeChoiceLabel(label);
    const right = normalizeChoiceLabel(target);
    if (!left || !right) {
      return false;
    }
    return left === right || left.includes(right) || right.includes(left);
  }

  async function tryFillCustomChoiceField(element, value, field) {
    const container = findChoiceFieldContainer(element);
    if (!container) {
      return { ok: false, reason: "no choice container found" };
    }

    container.scrollIntoView({ block: "center", inline: "nearest" });
    clickActionElement(element instanceof Element ? element : container);
    if (container !== element) {
      clickActionElement(container);
    }
    await sleep(220);

    const target = normalizeChoiceValue(value, inferFieldLabel(field));
    const hierarchicalResult = await tryFillHierarchicalChoiceOptions(value, target);
    if (hierarchicalResult.ok) {
      return hierarchicalResult;
    }

    const options = findVisibleChoiceOptions(container);
    const matched = options.find((option) => choiceTextMatches(getElementText(option), target) || choiceTextMatches(option.getAttribute("aria-label") || "", target));

    if (matched) {
      clickActionElement(matched);
      await sleep(120);
      return { ok: true };
    }

    const searchInput =
      element instanceof HTMLInputElement
        ? element
        : container.querySelector?.('input:not([type="hidden"]),textarea,[contenteditable="true"]');
    if (searchInput) {
      setNativeValue(searchInput, value);
      await sleep(160);
      const retryOptions = findVisibleChoiceOptions(container);
      const retryMatched = retryOptions.find((option) => choiceTextMatches(getElementText(option), target) || choiceTextMatches(option.getAttribute("aria-label") || "", target));
      if (retryMatched) {
        clickActionElement(retryMatched);
        await sleep(120);
        return { ok: true };
      }
      // the typed text filtered the list; restore the full option list for the AI fallback
      setNativeValue(searchInput, "");
      await sleep(120);
    }

    const allOptions = findVisibleChoiceOptions(container).filter((option) => isVisible(option));
    const picked = await aiPickOption(field, currentFillCandidate, value, allOptions.map((option) => getElementText(option)));
    if (picked) {
      const chosen = allOptions.find((option) => normalizeText(getElementText(option), 120) === picked.option);
      if (chosen) {
        clickActionElement(chosen);
        await sleep(120);
        return { ok: true, warning: `AI 选项匹配：${picked.option}`, aiMatched: true };
      }
    }

    return { ok: false, reason: "no matching option found" };
  }

  async function tryFillHierarchicalChoiceOptions(value, target) {
    const parts = splitHierarchicalChoiceValue(value);
    if (parts.length < 2) {
      return { ok: false, reason: "not hierarchical" };
    }

    let matchedAny = false;
    for (const part of parts) {
      const options = findVisibleChoiceOptions(document);
      const matched = options.find((option) => {
        const text = getElementText(option);
        return choiceTextMatches(text, part) || choiceTextMatches(text, target);
      });
      if (!matched) {
        return matchedAny ? { ok: true, warning: "hierarchical choice partially matched" } : { ok: false, reason: "no matching hierarchical option" };
      }

      clickActionElement(matched);
      matchedAny = true;
      await sleep(180);
    }

    return { ok: matchedAny };
  }

  function splitHierarchicalChoiceValue(value) {
    const text = normalizeText(value, 120);
    if (!/(省|自治区|北京市|上海市|天津市|重庆市|市|区|县)/.test(text)) {
      return [];
    }

    const parts = text.match(/[^省市区县]+(?:省|市|区|县)|[^自治区]+自治区/g) || [];
    const normalized = parts.map((part) => normalizeText(part, 40)).filter(Boolean);
    return normalized.length >= 2 ? normalized : [];
  }

  function findChoiceFieldContainer(element) {
    const adapterSelectors = getAdapterSelectors();
    if (adapterSelectors.containerSelector) {
      const container = element.closest(adapterSelectors.containerSelector);
      if (container) {
        return container;
      }
    }

    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      if (
        current.matches?.("[role='combobox'],[role='listbox'],[role='radio'],[role='checkbox'],[class*='select'],[class*='picker'],[class*='dropdown'],label") ||
        /select|picker|dropdown|combobox|radio|checkbox|ant-select|el-select|rc-select|cascader|picker/i.test(String(current.className || ""))
      ) {
        return current;
      }
    }
    return element.parentElement || element;
  }

  function findVisibleChoiceOptions(container) {
    const selectors = [
      '[role="option"]',
      "[aria-selected]",
      "li",
      ".ant-select-item-option",
      ".rc-select-item-option",
      ".ant-cascader-menu-item",
      ".ant-picker-cell",
      '[class*="option"]',
      '[class*="Option"]',
      '[class*="select-item"]',
      '[class*="dropdown-item"]'
    ].join(",");
    const roots = [container && container.querySelectorAll ? container : null, document].filter(Boolean);
    const seen = new Set();
    const options = [];

    for (const scope of roots) {
      for (const option of Array.from(scope.querySelectorAll(selectors))) {
        if (!(option instanceof Element) || seen.has(option)) {
          continue;
        }
        seen.add(option);
        if (option.closest(`#${PANEL_ID}`)) {
          continue;
        }
        if (!isVisible(option)) {
          continue;
        }
        const text = getElementText(option);
        if (text && text.length <= 120) {
          options.push(option);
        }
      }
    }

    return options;
  }

  function renderQuickCopyList(panel) {
    const list = panel.querySelector('[data-role="quick-copy-list"]');
    if (!list) {
      return;
    }

    list.textContent = "";

    if (!hasCurrentProfileData()) {
      const empty = document.createElement("div");
      empty.className = "arf-empty";
      empty.textContent = currentProfileLoadPromise
        ? "正在读取本机简历资料..."
        : "点击“设置”后先保存简历资料，这里会显示可参考和复制的内容。";
      list.append(empty);
      return;
    }

    const filterText = compactText(sidebarFilter);
    const allSections = getCurrentProfileSections();
    const sections = allSections
      .map((group) => ({
        ...group,
        items: filterText
          ? group.items.filter((item) => {
              return compactText(`${group.category} ${item.subsection || ""} ${item.label} ${item.value}`).includes(filterText);
            })
          : group.items
      }))
      .filter((group) => group.items.length > 0);

    if (sections.length === 0) {
      const empty = document.createElement("div");
      empty.className = "arf-empty";
      empty.textContent = sidebarFilter ? "没有匹配的资料项。" : "资料里还没有可展示的字段内容。";
      list.append(empty);
      return;
    }

    const activeSection = !filterText
      ? sections.find((section) => section.category === activeProfileCategory)
      : null;

    if (activeSection) {
      renderProfileReferenceDetail(list, activeSection);
      return;
    }

    if (filterText) {
      renderProfileReferenceSearchResults(list, sections);
      return;
    }

    renderProfileReferenceOverview(list, sections);
  }

  function renderProfileReferenceOverview(root, sections) {
    const overview = document.createElement("div");
    overview.className = "arf-overview";

    for (const section of sections) {
      const displayTitle = getProfileSectionTitle(section);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "arf-category-card";
      button.dataset.category = section.category;

      const main = document.createElement("div");
      const title = document.createElement("div");
      title.className = "arf-category-title";
      title.textContent = displayTitle;
      const note = document.createElement("div");
      note.className = "arf-category-note";
      note.textContent = summarizeProfileSection(section);
      main.append(title, note);

      const count = document.createElement("div");
      count.className = "arf-category-count";
      count.textContent = String(section.items.length);

      button.append(main, count);
      button.addEventListener("click", () => {
        activeProfileCategory = section.category;
        renderAndSaveProfilePanel();
      });
      overview.append(button);
    }

    root.append(overview);
  }

  function renderProfileReferenceSearchResults(root, sections) {
    const head = document.createElement("div");
    head.className = "arf-detail-head";
    const title = document.createElement("div");
    title.className = "arf-detail-title";
    const total = sections.reduce((sum, section) => sum + section.items.length, 0);
    title.textContent = `搜索结果 ${total} 条`;
    head.append(title);
    root.append(head);

    for (const section of sections) {
      renderProfileReferenceRows(root, section, { compactTitle: true });
    }
  }

  function renderProfileReferenceDetail(root, section) {
    const head = document.createElement("div");
    head.className = "arf-detail-head";

    const back = document.createElement("button");
    back.type = "button";
    back.className = "arf-back";
    back.textContent = "返回";
    back.addEventListener("click", () => {
      activeProfileCategory = "";
      renderAndSaveProfilePanel();
    });

    const title = document.createElement("div");
    title.className = "arf-detail-title";
    title.textContent = `${getProfileSectionTitle(section) || section.category} · ${section.items.length} 条`;
    head.append(back, title);
    root.append(head);

    renderProfileReferenceRows(root, section);
  }

  function renderProfileReferenceRows(root, section, options = {}) {
    const groups = groupItemsBySubsection(section.items);
    for (const group of groups) {
      const card = document.createElement("div");
      card.className = "arf-detail-card arf-readable";

      const subtitle = document.createElement("div");
      subtitle.className = "arf-subsection-title";
      subtitle.textContent = group.subsection || (options.compactTitle ? getProfileSectionTitle(section) || section.category : "详情");
      card.append(subtitle);

      for (const item of group.items) {
        const row = document.createElement("div");
        row.className = "arf-row";

        const label = document.createElement("div");
        label.className = "arf-row-label";
        label.textContent = item.label;

        const value = document.createElement("div");
        value.className = `arf-row-value${item.hasValue ? "" : " is-empty"}`;
        value.textContent = item.hasValue ? item.value : "未填写";

        row.append(label, value);
        card.append(row);
      }

      root.append(card);
    }
  }

  function groupItemsBySubsection(items) {
    const groups = [];
    for (const item of items) {
      const subsection = item.subsection || "";
      let group = groups.find((entry) => entry.subsection === subsection);
      if (!group) {
        group = { subsection, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  }

  function summarizeProfileSection(section) {
    const filled = section.items.filter((item) => item.hasValue);
    const source = filled.length > 0 ? filled : section.items;
    const labels = source.slice(0, 5).map((item) => item.label).join("、");
    if (!labels) {
      return "点开查看资料";
    }
    return labels;
  }

  async function copyActiveCategory() {
    const section = getCurrentProfileSections().find((item) => item.category === activeProfileCategory);
    if (!section) {
      setProfilePanelStatus("先点进一个分类，再复制本类内容。", true);
      return;
    }

    try {
      await copyTextToClipboard(formatProfileSectionForCopy(section));
      setProfilePanelStatus(`已复制：${getProfileSectionTitle(section) || section.category}`);
    } catch (error) {
      setProfilePanelStatus(`复制失败：${error.message}`, true);
    }
  }

  function formatProfileSectionForCopy(section) {
    const title = getProfileSectionTitle(section) || section.category;
    const lines = [`## ${title}`];
    for (const group of groupItemsBySubsection(section.items)) {
      if (group.subsection) {
        lines.push("", `### ${group.subsection}`);
      }
      for (const item of group.items) {
        lines.push(`- ${item.label}：${item.value || ""}`);
      }
    }
    return `${lines.join("\n").trim()}\n`;
  }

  function renderProfilePanel() {
    const panel = ensureProfilePanel();
    const status = panel.querySelector('[data-role="status"]');
    const collapseBtn = panel.querySelector('[data-action="collapse"]');
    const homeBtn = panel.querySelector('[data-action="home"]');
    const copyCategoryBtn = panel.querySelector('[data-action="copy-category"]');
    const searchInput = panel.querySelector('[data-role="quick-copy-search"]');
    const progress = panel.querySelector('[data-role="progress"]');
    const progressFill = panel.querySelector('[data-role="progress-fill"]');
    const progressStage = panel.querySelector('[data-role="progress-stage"]');
    const progressDetail = panel.querySelector('[data-role="progress-detail"]');
    const sections = getCurrentProfileSections();
    const activeSection = sections.find((section) => section.category === activeProfileCategory);
    const inProgress = Boolean(autofillInProgress || autofillProgress.active);
    if (activeProfileCategory && !activeSection) {
      activeProfileCategory = "";
    }
    panel.setAttribute(PANEL_COLLAPSED_ATTR, profilePanelCollapsed ? "true" : "false");
    if (collapseBtn) {
      collapseBtn.textContent = profilePanelCollapsed ? "资料" : "收起";
      collapseBtn.title = profilePanelCollapsed ? "展开 OpenJobAutofill 资料面板" : "收起 OpenJobAutofill 资料面板";
    }
    if (copyCategoryBtn) {
      copyCategoryBtn.disabled = !activeSection;
    }
    if (homeBtn) {
      homeBtn.disabled = false;
    }
    if (searchInput && searchInput.value !== sidebarFilter) {
      searchInput.value = sidebarFilter;
    }
    if (progress && progressFill && progressStage && progressDetail) {
      progress.hidden = !autofillProgress.active;
      progressFill.style.width = `${getDisplayedProgressPercent()}%`;
      progressStage.textContent = autofillProgress.active
        ? getAutofillProgressTitle() || "处理中"
        : "";
      progressDetail.textContent = autofillProgress.active ? getAutofillProgressDetail() : "";
    }
    if (status) {
      status.style.color = "#6f6a60";
      const totalItems = sections.reduce((sum, group) => sum + group.items.length, 0);
      const adapter = getActiveSiteAdapter();
      const adapterLabel = adapter ? `${adapter.name || adapter.id || "通用"} · ` : "";
      if (autofillProgress.active) {
        status.textContent = `${adapterLabel}${getAutofillProgressDetail() || getAutofillProgressTitle() || autofillProgress.stage || "正在处理"}`;
      } else {
        status.textContent = activeSection
          ? `${adapterLabel}正在查看：${getProfileSectionTitle(activeSection) || activeSection.category}。内容可直接选中复制。`
          : totalItems > 0
            ? `${adapterLabel}已加载 ${sections.length} 个分类、${totalItems} 条本地资料。`
            : `${adapterLabel}资料只从本机读取。`;
      }
    }

    renderQuickCopyList(panel);
    if (!currentProfileV2 && !currentProfileLoadPromise) {
      void refreshCurrentProfile();
    }
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.documentElement.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    textarea.remove();
    if (!success) {
      throw new Error("Clipboard unavailable.");
    }
  }

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes.profileV2) {
        return;
      }

      currentProfileV2 = changes.profileV2.newValue || null;
      if (profilePanelVisible) {
        renderProfilePanel();
      }
    });
  }

  void restoreProfilePanelState();
  void restoreLearningRecords();

  // ---------------------------------------------------------------------------
  // Learn from page edits: after autofill, watch what the user changes or adds on
  // the form and offer to write those values back into the local profile.
  // ---------------------------------------------------------------------------

  const LEARNING_CATEGORY_TO_SECTION = {
    "社团工作": "student",
    "学生工作": "student",
    "专业资格": "certificates",
    "证书技能": "certificates",
    "语言能力": "language",
    "家庭信息": "family",
    "项目经历": "project",
    "论文著作": "papers",
    "专利成果": "patent",
    "计算机技能": "computer"
  };

  const LEARNING_LABEL_ALIASES = [
    ["手机号码", "电话"],
    ["手机号", "电话"],
    ["手机", "电话"],
    ["联系电话", "电话"],
    ["电子邮箱", "邮箱"],
    ["邮件", "邮箱"],
    ["Email", "邮箱"],
    ["出生年月", "出生日期"],
    ["身份证号", "证件号码"],
    ["身份证号码", "证件号码"],
    ["证件号", "证件号码"],
    ["毕业院校", "学校"],
    ["学校名称", "学校"],
    ["院校", "学校"],
    ["专业名称", "专业"],
    ["所学专业", "专业"],
    ["学历层次", "学历"],
    ["学位名称", "学位"],
    ["入学时间", "开始时间"],
    ["毕业时间", "结束时间"],
    ["入职时间", "开始时间"],
    ["离职时间", "结束时间"],
    ["单位名称", "公司"],
    ["公司名称", "公司"],
    ["工作单位", "公司"],
    ["实习单位", "公司"],
    ["职位名称", "职位"],
    ["岗位", "职位"],
    ["岗位名称", "职位"],
    ["职务", "职位"],
    ["工作描述", "工作内容"],
    ["工作职责", "工作内容"],
    ["项目描述", "项目内容"],
    ["项目职责", "本人职责"],
    ["奖项名称", "奖惩名称"],
    ["获奖时间", "奖惩时间"],
    ["获奖名称", "奖惩名称"],
    ["证书名称", "证书名称（技能名称）"],
    ["技能名称", "证书名称（技能名称）"],
    ["语种", "外语种类"],
    ["家庭住址", "现居住详细地址"],
    ["现住址", "现居住详细地址"],
    ["居住地址", "现居住详细地址"],
    ["户口所在地", "户籍"],
    ["籍贯", "籍贯"],
    ["自我介绍", "自我描述"]
  ];

  function getSchemaSection(sectionKey) {
    return PROFILE_SCHEMA.find((section) => section.key === sectionKey) || null;
  }

  function resolveLearningSectionKey(category) {
    const text = normalizeText(category, 60);
    if (!text) {
      return "";
    }
    const direct = PROFILE_SCHEMA.find((section) => normalizeProfileCategory(section.title) === text);
    if (direct) {
      return direct.key;
    }
    if (LEARNING_CATEGORY_TO_SECTION[text]) {
      return LEARNING_CATEGORY_TO_SECTION[text];
    }
    const byTitle = PROFILE_SCHEMA.find((section) => section.title === text);
    return byTitle ? byTitle.key : "";
  }

  function matchSchemaLabel(section, fieldLabel) {
    if (!section || !Array.isArray(section.fields)) {
      return "";
    }
    const key = normalizeMatchKey(fieldLabel);
    if (!key) {
      return "";
    }

    const exact = section.fields.find((label) => normalizeMatchKey(label) === key);
    if (exact) {
      return exact;
    }

    for (const [alias, target] of LEARNING_LABEL_ALIASES) {
      if (normalizeMatchKey(alias) === key && section.fields.includes(target)) {
        return target;
      }
    }

    const contained = section.fields
      .filter((label) => {
        const labelKey = normalizeMatchKey(label);
        return labelKey.length >= 2 && key.length >= 2 && (key.includes(labelKey) || labelKey.includes(key));
      })
      .sort((left, right) => Math.abs(normalizeMatchKey(left).length - key.length) - Math.abs(normalizeMatchKey(right).length - key.length));
    return contained[0] || "";
  }

  function parseProfileItemPath(path) {
    const match = /^profileV2\.sections\.([^.[\]]+)(?:\.items\[(\d+)\])?\.(values|custom)\[(\d+)\]/.exec(String(path || ""));
    if (!match) {
      return null;
    }
    return {
      sectionKey: match[1],
      itemIndex: match[2] == null ? null : Number(match[2]),
      kind: match[3],
      index: Number(match[4])
    };
  }

  function getProfileSectionByKey(sectionKey) {
    if (!currentProfileV2 || !sectionKey) {
      return null;
    }
    return (
      currentProfileV2.sections?.[sectionKey] ||
      (Array.isArray(currentProfileV2.customSections) ? currentProfileV2.customSections.find((section) => section.key === sectionKey) : null) ||
      null
    );
  }

  function getProfileSectionItems(sectionKey) {
    const section = getProfileSectionByKey(sectionKey);
    return Array.isArray(section?.items) ? section.items : [];
  }

  function describeProfileItem(sectionKey, index) {
    const schemaSection = getSchemaSection(sectionKey);
    const items = getProfileSectionItems(sectionKey);
    const item = items[index];
    const fallback = `${schemaSection?.itemLabel || schemaSection?.title || "条目"} ${index + 1}`;
    if (!item) {
      return fallback;
    }
    const title = normalizeText(item.title || "", 60);
    const hint = Object.values(item.values || {}).find((value) => normalizeText(value, 40));
    return title || (hint ? `${fallback}（${normalizeText(hint, 24)}）` : fallback);
  }

  function hashLearningKey(text) {
    let hash = 5381;
    const value = String(text || "");
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
    }
    return (hash >>> 0).toString(36);
  }

  const LEARNING_PLACEHOLDER_VALUE = /^(请选择|请先选择|请输入|请填写|选择|--|—|无|请选择日期|请选择时间)$/;
  const LEARNING_WIDGET_VALUE_SELECTOR = [
    ".ant-select-selection-item",
    ".ant-select-selection-item-content",
    ".ant-cascader-picker-label",
    ".el-select__selected-item",
    ".el-select__tags-text",
    ".el-input__inner",
    ".rc-select-selection-item",
    "[class*='selection-item']",
    "[class*='selected-value']",
    "[class*='single-value']",
    "[class*='selected-text']",
    "[class*='display-value']"
  ].join(",");

  function getLearningControlValue(element) {
    if (element instanceof HTMLSelectElement) {
      const option = element.selectedOptions?.[0];
      const text = normalizeText(option?.textContent || "", 260);
      return !text || LEARNING_PLACEHOLDER_VALUE.test(text) ? "" : text;
    }

    const native = getControlCurrentValue(element);
    if (native && !LEARNING_PLACEHOLDER_VALUE.test(native)) {
      return native;
    }

    // Custom select / picker widgets keep the chosen text in a sibling node, not in the input.
    const type = getControlType(element);
    const isWidgetInput = type === "combobox" || element.readOnly || element.getAttribute("aria-readonly") === "true" || element.getAttribute("aria-haspopup");
    if (!isWidgetInput) {
      return native;
    }
    // findChoiceFieldContainer may return the control itself (role=combobox); start from the parent.
    const container = element.parentElement ? findChoiceFieldContainer(element.parentElement) : null;
    if (!container || container === element || container.closest(`#${PANEL_ID},#${FLOAT_ID},#${LEARNING_PANEL_ID}`)) {
      return native;
    }
    for (const node of container.querySelectorAll(LEARNING_WIDGET_VALUE_SELECTOR)) {
      if (node === element || node.contains(element)) {
        continue;
      }
      const text = normalizeText(node instanceof HTMLInputElement ? node.value : node.getAttribute("title") || node.textContent, 260);
      if (text && !LEARNING_PLACEHOLDER_VALUE.test(text) && text !== normalizeText(element.getAttribute("placeholder") || "", 260)) {
        return text;
      }
    }
    return native;
  }

  function setupLearningBaseline(plan, fillResults = []) {
    const fields = new Map();
    const resultById = new Map((Array.isArray(fillResults) ? fillResults : []).map((result) => [result.id, result]));
    const candidateByFieldId = new Map((plan?.candidates || []).map((candidate) => [candidate.fieldId, candidate]));

    for (const field of plan?.scan?.fields || []) {
      if (!field?.canFill) {
        continue;
      }
      const candidate = candidateByFieldId.get(field.fieldId) || null;
      const filled = Boolean(candidate && resultById.get(candidate.id)?.ok);
      const element = findFieldElement(field);
      const baselineValue = element ? getLearningControlValue(element) : filled ? candidate.value : field.currentValue || "";
      fields.set(field.fieldId, {
        field: {
          ...field,
          inferredLabel: candidate?.fieldLabel || field.inferredLabel || inferFieldLabel(field),
          inferredCategory: candidate?.fieldCategory || field.inferredCategory || inferMatchSection(field)
        },
        baselineValue,
        candidate,
        filled,
        ignoredValue: ""
      });
    }

    learningBaseline = {
      pageKey: getPageKey(),
      createdAt: new Date().toISOString(),
      fields
    };
    attachLearningListeners();
  }

  function attachLearningListeners() {
    if (learningListenersAttached) {
      return;
    }
    learningListenersAttached = true;
    document.addEventListener("change", handleLearningControlEvent, true);
    document.addEventListener("input", handleLearningControlEvent, true);
    document.addEventListener("focusout", handleLearningControlEvent, true);
    document.addEventListener("click", scheduleLearningFullDiff, true);
    document.addEventListener("keyup", scheduleLearningFullDiff, true);
  }

  let learningFullDiffTimer = null;

  function scheduleLearningFullDiff(event) {
    if (!learningTrackingEnabled || !learningBaseline) {
      return;
    }
    const target = event?.target;
    if (target instanceof Element && target.closest(`#${PANEL_ID},#${FLOAT_ID},#${LEARNING_PANEL_ID}`)) {
      return;
    }
    if (learningFullDiffTimer) {
      clearTimeout(learningFullDiffTimer);
    }
    learningFullDiffTimer = setTimeout(() => {
      learningFullDiffTimer = null;
      const before = JSON.stringify(learningRecords.map((record) => [record.id, record.newValue]));
      scanLearningDiffNow();
      const after = JSON.stringify(learningRecords.map((record) => [record.id, record.newValue]));
      if (before !== after) {
        commitLearningRecords();
      }
    }, 900);
  }

  function handleLearningControlEvent(event) {
    if (!learningTrackingEnabled || !learningBaseline) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || target.closest(`#${PANEL_ID},#${FLOAT_ID},#${LEARNING_PANEL_ID}`)) {
      return;
    }
    const control = target.matches(CONTROL_SELECTOR) ? target : target.closest(CONTROL_SELECTOR);
    if (!control) {
      return;
    }
    scheduleLearningDiff(control);
  }

  function scheduleLearningDiff(element) {
    const existing = learningDiffTimers.get(element);
    if (existing) {
      clearTimeout(existing);
    }
    learningDiffTimers.set(
      element,
      setTimeout(() => {
        learningDiffTimers.delete(element);
        evaluateLearningControl(element);
      }, LEARNING_DIFF_DEBOUNCE_MS)
    );
  }

  function getLearningEntryForElement(element) {
    if (!learningBaseline) {
      return null;
    }
    const fieldId = element.getAttribute(FIELD_ATTR);
    let entry = fieldId ? learningBaseline.fields.get(fieldId) : null;
    if (entry) {
      return entry;
    }

    // Control appeared after the scan (dynamic form section); treat its first value as new.
    const meta = buildFieldMeta(element);
    if (!meta.canFill) {
      return null;
    }
    entry = {
      field: { ...meta, inferredLabel: inferFieldLabel(meta), inferredCategory: inferMatchSection(meta) },
      baselineValue: "",
      candidate: null,
      filled: false,
      ignoredValue: "",
      dynamic: true
    };
    learningBaseline.fields.set(meta.fieldId, entry);
    return entry;
  }

  function evaluateLearningControl(element) {
    const entry = getLearningEntryForElement(element);
    if (!entry) {
      return;
    }
    const changedValue = detectLearningChange(entry, element);
    const record = changedValue === null ? null : buildLearningRecord(entry, element, changedValue);
    if (!record) {
      removeLearningRecord(buildLearningRecordId(entry.field), { silent: true });
      commitLearningRecords();
      return;
    }
    upsertLearningRecord(record);
    commitLearningRecords();
  }

  function detectLearningChange(entry, element) {
    const type = getControlType(element);
    if (["checkbox", "radio", "file", "hidden", "submit", "button", "password"].includes(type)) {
      return null;
    }
    const currentValue = getLearningControlValue(element);
    if (!hasMeaningfulControlValue(element, entry.field.inferredLabel, currentValue)) {
      return null;
    }
    const reference = entry.filled && entry.candidate ? entry.candidate.value : entry.baselineValue;
    if (normalizeText(currentValue) === normalizeText(reference) || normalizeText(currentValue) === normalizeText(entry.baselineValue)) {
      return null;
    }
    if (entry.ignoredValue && normalizeText(currentValue) === normalizeText(entry.ignoredValue)) {
      return null;
    }
    if (reference && valuesLookEquivalent(currentValue, reference)) {
      return null;
    }
    return currentValue;
  }

  function buildLearningRecordId(field) {
    return `learn_${hashLearningKey(`${getPageKey()}|${field.cssPath || field.fieldId}`)}`;
  }

  function buildLearningRecord(entry, element, newValue) {
    const field = entry.field;
    const base = {
      id: buildLearningRecordId(field),
      pageKey: getPageKey(),
      pageTitle: normalizeText(document.title, 120),
      hostname: location.hostname,
      fieldId: field.fieldId,
      fieldLabel: field.inferredLabel || field.label || field.placeholder || field.name || "未命名字段",
      fieldCategory: field.inferredCategory || "",
      newValue: String(newValue),
      updatedAt: new Date().toISOString()
    };

    const path = entry.filled && entry.candidate ? parseProfileItemPath(entry.candidate.sourceItemId) : null;
    if (path) {
      const schemaSection = getSchemaSection(path.sectionKey);
      const section = getProfileSectionByKey(path.sectionKey);
      const sourceLabel = entry.candidate.sourceLabel || "";
      const pageLabelMatch = matchSchemaLabel(schemaSection, field.inferredLabel);
      const isRepeat = path.itemIndex !== null;

      const alias = resolveLearningAliasTarget(field, newValue, { target: { sectionKey: path.sectionKey, itemIndex: path.itemIndex } });
      if (alias) {
        if (normalizeMatchKey(alias.aliasOf) === normalizeMatchKey(sourceLabel)) {
          return null; // same field, another entry: the value exists already; nothing to learn
        }
        return { ...base, oldValue: "", ...alias };
      }

      // The page label clearly names a different field than the one autofill used: the
      // original mapping was probably wrong, so add under the page's own label instead of
      // overwriting the profile value that was mis-filled here.
      if (pageLabelMatch && normalizeMatchKey(pageLabelMatch) !== normalizeMatchKey(sourceLabel)) {
        return {
          ...base,
          action: "add",
          oldValue: "",
          selected: true,
          target: {
            sectionKey: path.sectionKey,
            sectionTitle: schemaSection?.title || section?.title || path.sectionKey,
            sectionKind: isRepeat ? "repeat" : "simple",
            kind: "values",
            label: pageLabelMatch,
            itemIndex: path.itemIndex,
            itemLabel: schemaSection?.itemLabel || "",
            itemTitle: isRepeat ? describeProfileItem(path.sectionKey, path.itemIndex) : ""
          }
        };
      }

      return {
        ...base,
        action: "update",
        oldValue: String(entry.candidate.value || ""),
        selected: true,
        target: {
          sectionKey: path.sectionKey,
          sectionTitle: schemaSection?.title || section?.title || path.sectionKey,
          sectionKind: isRepeat ? "repeat" : "simple",
          kind: path.kind,
          label: sourceLabel,
          itemIndex: path.itemIndex,
          itemLabel: schemaSection?.itemLabel || "",
          itemTitle: isRepeat ? describeProfileItem(path.sectionKey, path.itemIndex) : ""
        }
      };
    }

    const sectionKey = resolveLearningSectionForField(field);
    const addTarget = resolveLearningAddTarget(sectionKey, field.inferredLabel, element);
    if (addTarget.action === "add") {
      return { ...base, oldValue: "", ...addTarget };
    }
    return { ...base, oldValue: "", ...(resolveLearningAliasTarget(field, newValue, addTarget) || addTarget) };
  }

  const LEARNING_GENERIC_VALUE = /^(是|否|有|无|男|女|其他|无|none|n\/a|yes|no)$/i;

  // Returns an alias target when `value` equals a value already stored in the profile: the page
  // simply calls that field by another name (毕业院校 vs 学校, 全日制本科 vs 全日制).
  function resolveLearningAliasTarget(field, value, fallback) {
    const normalized = normalizeComparableValue(value);
    if (!normalized || normalized.length < 2 || LEARNING_GENERIC_VALUE.test(normalized)) {
      return null;
    }
    const preferredSection = fallback?.target?.sectionKey || "";
    const preferredItem = Number.isInteger(fallback?.target?.itemIndex) ? fallback.target.itemIndex : null;
    const matches = getCurrentProfileEntries()
      .filter((entry) => entry?.hasValue && normalizeComparableValue(entry.value) === normalized)
      .map((entry) => ({ entry, sectionKey: getEntrySectionKey(entry), itemIndex: getEntryItemIndex(entry) }))
      .filter((match) => match.sectionKey);
    if (matches.length === 0) {
      return null;
    }
    matches.sort((left, right) => {
      const score = (match) => (match.sectionKey === preferredSection ? 2 : 0) + (match.itemIndex === preferredItem ? 1 : 0);
      return score(right) - score(left);
    });
    const best = matches[0];
    if (preferredSection && best.sectionKey !== preferredSection && matches.some((match) => match.sectionKey !== best.sectionKey)) {
      return null; // same value in several sections and none is the expected one: too ambiguous
    }
    const schemaSection = getSchemaSection(best.sectionKey);
    const isRepeat = schemaSection ? schemaSection.kind === "repeat" : best.itemIndex !== null;
    return {
      action: "alias",
      selected: true,
      aliasOf: best.entry.label,
      target: {
        sectionKey: best.sectionKey,
        sectionTitle: schemaSection?.title || getProfileSectionByKey(best.sectionKey)?.title || best.sectionKey,
        sectionKind: isRepeat ? "repeat" : "simple",
        kind: "custom",
        label: normalizeText(field.inferredLabel, 80),
        itemIndex: isRepeat ? best.itemIndex : null,
        itemLabel: schemaSection?.itemLabel || "",
        itemTitle: isRepeat && best.itemIndex !== null ? describeProfileItem(best.sectionKey, best.itemIndex) : ""
      }
    };
  }

  function resolveLearningSectionForField(field) {
    // Prefer the section heading the control actually sits under; fall back to the inferred
    // category (which can be dominated by page-wide text on small forms).
    const headingText = normalizeText(String(field.section || "").split("|")[0], 80);
    const headingCategory = headingText ? normalizeProfileCategory(headingText) : "";
    const keys = [];
    for (const category of [headingCategory, field.inferredCategory]) {
      const key = resolveLearningSectionKey(category);
      if (key && !keys.includes(key)) {
        keys.push(key);
      }
    }
    const withLabel = keys.find((key) => matchSchemaLabel(getSchemaSection(key), field.inferredLabel));
    return withLabel || keys[0] || "";
  }

  function resolveLearningAddTarget(sectionKey, fieldLabel, element) {
    const schemaSection = getSchemaSection(sectionKey);
    if (!schemaSection) {
      return {
        action: "unresolved",
        selected: false,
        target: { sectionKey: "", sectionTitle: "", sectionKind: "simple", kind: "values", label: normalizeText(fieldLabel, 80), itemIndex: null, itemLabel: "", itemTitle: "" }
      };
    }

    const label = matchSchemaLabel(schemaSection, fieldLabel);
    const isRepeat = schemaSection.kind === "repeat";
    const itemIndex = isRepeat ? resolveLearningItemIndex(element, sectionKey) : null;
    const ready = !isRepeat || Number.isInteger(itemIndex);
    return {
      action: label ? "add" : "custom",
      selected: Boolean(label) && ready,
      target: {
        sectionKey,
        sectionTitle: schemaSection.title,
        sectionKind: isRepeat ? "repeat" : "simple",
        kind: label ? "values" : "custom",
        label: label || normalizeText(fieldLabel, 80),
        itemIndex,
        itemLabel: schemaSection.itemLabel || "",
        itemTitle: Number.isInteger(itemIndex) && itemIndex >= 0 ? describeProfileItem(sectionKey, itemIndex) : ""
      }
    };
  }

  function resolveLearningItemIndex(element, sectionKey) {
    const siblingIndex = findNearestSiblingItemIndex(element, sectionKey);
    if (siblingIndex !== null) {
      return siblingIndex;
    }

    const items = getProfileSectionItems(sectionKey);
    if (items.length === 0) {
      return -1;
    }
    if (items.length === 1) {
      return 0;
    }
    return null;
  }

  function isLearningRecordReady(record) {
    const target = record?.target || {};
    return Boolean(
      target.sectionKey &&
        target.label &&
        normalizeText(record.newValue) &&
        (target.sectionKind !== "repeat" || Number.isInteger(target.itemIndex))
    );
  }

  function upsertLearningRecord(record) {
    const index = learningRecords.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      const previous = learningRecords[index];
      // Keep the user's manual target choice when only the value changed.
      learningRecords[index] = previous.userAdjusted ? { ...previous, newValue: record.newValue, updatedAt: record.updatedAt } : record;
    } else {
      learningRecords.push(record);
    }
  }

  function removeLearningRecord(id, options = {}) {
    const before = learningRecords.length;
    learningRecords = learningRecords.filter((record) => record.id !== id);
    learningOtherRecords = learningOtherRecords.filter((record) => record.id !== id);
    if (!options.silent && before !== learningRecords.length) {
      commitLearningRecords();
    }
  }

  function commitLearningRecords() {
    renderFloatingStatus();
    if (learningPanel && !learningPanel.hidden) {
      renderLearningPanel();
    }
    scheduleLearningSync();
  }

  function scheduleLearningSync() {
    if (learningSyncTimer) {
      clearTimeout(learningSyncTimer);
    }
    learningSyncTimer = setTimeout(() => {
      learningSyncTimer = null;
      void sendRuntimeMessage({
        type: "OJAF_SAVE_LEARNING_RECORDS",
        payload: { pageKey: getPageKey(), records: learningRecords }
      }).catch(() => {});
    }, LEARNING_SYNC_DEBOUNCE_MS);
  }

  async function restoreLearningRecords() {
    try {
      const state = await sendRuntimeMessage({ type: "OJAF_GET_LEARNING_STATE" });
      const pageKey = getPageKey();
      const records = Array.isArray(state?.records) ? state.records : [];
      learningRecords = records.filter((record) => record.pageKey === pageKey);
      learningOtherRecords = records.filter((record) => record.pageKey !== pageKey);
      if (learningRecords.length > 0) {
        renderFloatingStatus();
      }
    } catch {
      // background not reachable yet; records stay empty
    }
  }

  function scanLearningDiffNow() {
    if (!learningBaseline) {
      return;
    }
    for (const entry of learningBaseline.fields.values()) {
      if (entry.dynamic) {
        continue;
      }
      const element = findFieldElement(entry.field);
      if (!element) {
        continue;
      }
      const changedValue = detectLearningChange(entry, element);
      const record = changedValue === null ? null : buildLearningRecord(entry, element, changedValue);
      if (!record) {
        learningRecords = learningRecords.filter((item) => item.id !== buildLearningRecordId(entry.field));
      } else {
        upsertLearningRecord(record);
      }
    }
  }

  async function openLearningPanel() {
    injectStyle();
    const panel = ensureLearningPanel();
    panel.hidden = false;
    setProfilePanelVisible(false);
    setLearningPanelStatus("正在对比页面修改...");
    if (learningBaseline) {
      scanLearningDiffNow();
    }
    try {
      const state = await sendRuntimeMessage({ type: "OJAF_GET_LEARNING_STATE" });
      const pageKey = getPageKey();
      const records = Array.isArray(state?.records) ? state.records : [];
      learningOtherRecords = records.filter((record) => record.pageKey !== pageKey);
      if (!learningBaseline) {
        learningRecords = records.filter((record) => record.pageKey === pageKey);
      }
    } catch {
      // keep in-memory records
    }
    if (!currentProfileV2) {
      await refreshCurrentProfile();
    }
    renderLearningPanel();
    scheduleLearningSync();
    setLearningPanelStatus(
      learningBaseline
        ? ""
        : learningRecords.length > 0
          ? "显示的是本页之前暂存的修改；重新点击“开始填写”后会继续实时记录。"
          : "本页还没有执行过“开始填写”，先填写一次才能对比修改。"
    );
    renderFloatingStatus();
    if (learningAutoClassify && currentApiUsable) {
      void aiClassifyLearningRecords({ auto: true });
    }
    return { count: learningRecords.length + learningOtherRecords.length };
  }

  function closeLearningPanel() {
    if (learningPanel) {
      learningPanel.hidden = true;
    }
  }

  function ensureLearningPanel() {
    if (learningPanel && document.documentElement.contains(learningPanel)) {
      return learningPanel;
    }

    const panel = document.createElement("section");
    panel.id = LEARNING_PANEL_ID;
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "更新资料库");

    const head = document.createElement("div");
    head.className = "arf-learn-head";
    const headText = document.createElement("div");
    const title = document.createElement("div");
    title.className = "arf-learn-title";
    title.textContent = "更新资料库";
    const sub = document.createElement("div");
    sub.className = "arf-learn-sub";
    sub.dataset.role = "learn-sub";
    headText.append(title, sub);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "arf-learn-close";
    close.title = "关闭";
    close.textContent = "×";
    close.addEventListener("click", closeLearningPanel);
    head.append(headText, close);

    const list = document.createElement("div");
    list.className = "arf-learn-list";
    list.dataset.role = "learn-list";

    const foot = document.createElement("div");
    foot.className = "arf-learn-foot";
    const privacy = document.createElement("div");
    privacy.className = "arf-learn-privacy";
    privacy.textContent = "写入只发生在本机资料库；AI 归类只发送字段名称，不发送你填写的值。";
    const status = document.createElement("div");
    status.className = "arf-learn-status";
    status.dataset.role = "learn-status";
    const actions = document.createElement("div");
    actions.className = "arf-learn-actions";
    const aiButton = document.createElement("button");
    aiButton.type = "button";
    aiButton.className = "secondary";
    aiButton.dataset.role = "learn-ai";
    aiButton.textContent = "AI 归类未匹配项";
    aiButton.addEventListener("click", () => {
      void aiClassifyLearningRecords();
    });
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.dataset.role = "learn-apply";
    applyButton.textContent = "写入资料库";
    applyButton.addEventListener("click", () => {
      void applySelectedLearningRecords();
    });
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "ghost";
    clearButton.dataset.role = "learn-clear";
    clearButton.textContent = "全部忽略";
    clearButton.addEventListener("click", () => {
      void discardAllLearningRecords();
    });
    actions.append(aiButton, applyButton, clearButton);
    foot.append(privacy, status, actions);

    panel.append(head, list, foot);
    document.documentElement.appendChild(panel);
    learningPanel = panel;
    return panel;
  }

  function setLearningPanelStatus(message, isError = false) {
    const status = learningPanel?.querySelector('[data-role="learn-status"]');
    if (!status) {
      return;
    }
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  function getAllLearningRecords() {
    return [...learningRecords, ...learningOtherRecords];
  }

  function findLearningRecord(id) {
    return learningRecords.find((record) => record.id === id) || learningOtherRecords.find((record) => record.id === id) || null;
  }

  function renderLearningPanel() {
    const panel = ensureLearningPanel();
    const list = panel.querySelector('[data-role="learn-list"]');
    const sub = panel.querySelector('[data-role="learn-sub"]');
    const aiButton = panel.querySelector('[data-role="learn-ai"]');
    const applyButton = panel.querySelector('[data-role="learn-apply"]');
    const clearButton = panel.querySelector('[data-role="learn-clear"]');
    if (!list) {
      return;
    }

    list.textContent = "";
    const all = getAllLearningRecords();
    const selectedReady = all.filter((record) => record.selected && isLearningRecordReady(record)).length;
    const needsAi = all.filter((record) => record.action === "unresolved" || record.action === "custom").length;

    if (sub) {
      sub.textContent = all.length > 0
        ? `本页 ${learningRecords.length} 处，其他页面暂存 ${learningOtherRecords.length} 处。勾选后写入本机资料库，不勾选的会继续保留在这里。`
        : "填写完成后，你在页面上修改或补填的内容会出现在这里。";
    }

    if (all.length === 0) {
      const empty = document.createElement("div");
      empty.className = "arf-learn-empty";
      empty.textContent = "还没有记录到修改。填写完成后直接在网页上改动字段，这里会自动出现建议。";
      list.append(empty);
    } else {
      if (learningRecords.length > 0) {
        list.append(createLearningGroupLabel("本页修改"));
        learningRecords.forEach((record) => list.append(renderLearningRecord(record, false)));
      }
      if (learningOtherRecords.length > 0) {
        list.append(createLearningGroupLabel("其他页面暂存"));
        learningOtherRecords.forEach((record) => list.append(renderLearningRecord(record, true)));
      }
    }

    if (aiButton) {
      aiButton.hidden = needsAi === 0;
      aiButton.textContent = `AI 归类未匹配项（${needsAi}）`;
      aiButton.disabled = learningPanelBusy;
    }
    if (applyButton) {
      applyButton.textContent = selectedReady > 0 ? `写入资料库（${selectedReady}）` : "写入资料库";
      applyButton.disabled = learningPanelBusy || selectedReady === 0;
    }
    if (clearButton) {
      clearButton.disabled = learningPanelBusy || all.length === 0;
    }
  }

  function createLearningGroupLabel(text) {
    const label = document.createElement("div");
    label.className = "arf-learn-group";
    label.textContent = text;
    return label;
  }

  function renderLearningRecord(record, isOtherPage) {
    const item = document.createElement("div");
    item.className = "arf-learn-item";
    item.dataset.recordId = record.id;
    const ready = isLearningRecordReady(record);
    if (!ready) {
      item.classList.add("is-unready");
    }

    const checkWrap = document.createElement("label");
    checkWrap.className = "arf-learn-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(record.selected && ready);
    checkbox.disabled = !ready;
    checkbox.title = ready ? "写入时包含这一项" : "先选择归属后才能写入";
    checkbox.addEventListener("change", () => {
      record.selected = checkbox.checked;
      record.userAdjusted = true;
      renderLearningPanel();
      scheduleLearningSync();
    });
    checkWrap.append(checkbox);

    const body = document.createElement("div");
    body.className = "arf-learn-body";

    const line = document.createElement("div");
    line.className = "arf-learn-line";
    const badge = document.createElement("span");
    badge.className = `arf-learn-badge is-${record.action}`;
    badge.textContent = { update: "更新", add: "新增", alias: "同义字段", custom: "自定义字段", unresolved: "待归类" }[record.action] || "待归类";
    const fieldName = document.createElement("span");
    fieldName.className = "arf-learn-field";
    fieldName.textContent = record.fieldLabel || "未命名字段";
    line.append(badge, fieldName);
    if (isOtherPage) {
      const page = document.createElement("span");
      page.className = "arf-learn-page";
      page.textContent = record.pageTitle ? `${record.hostname} · ${record.pageTitle}` : record.hostname || "其他页面";
      line.append(page);
    }

    const target = document.createElement("div");
    target.className = "arf-learn-target";
    target.append(document.createTextNode("→ "));
    target.append(renderLearningSectionControl(record));
    if (record.target?.sectionKey) {
      const schemaSection = getSchemaSection(record.target.sectionKey);
      if (schemaSection?.kind === "repeat" || record.target.sectionKind === "repeat") {
        target.append(document.createTextNode(" / "));
        target.append(renderLearningItemControl(record));
      }
      target.append(document.createTextNode(` / ${record.target.label || record.fieldLabel}`));
    }

    const values = document.createElement("div");
    values.className = "arf-learn-values";
    if (record.action === "alias" && record.aliasOf) {
      const hint = document.createElement("div");
      hint.className = "arf-learn-hint";
      hint.textContent = `值与「${record.aliasOf}」相同：只记住这个网站叫它「${record.fieldLabel}」，下次直接匹配。`;
      body.append(hint);
    }
    if (record.oldValue) {
      const old = document.createElement("s");
      old.textContent = formatCandidateValue(record.oldValue, 80);
      values.append(old, document.createTextNode(" → "));
    }
    const next = document.createElement("strong");
    next.textContent = formatCandidateValue(record.newValue, 160);
    values.append(next);

    body.append(line, target, values);

    const ignore = document.createElement("button");
    ignore.type = "button";
    ignore.className = "arf-learn-ignore";
    ignore.title = "忽略这一项";
    ignore.textContent = "×";
    ignore.addEventListener("click", () => {
      ignoreLearningRecord(record.id);
    });

    item.append(checkWrap, body, ignore);
    return item;
  }

  function renderLearningSectionControl(record) {
    if (record.action === "update") {
      const text = document.createElement("span");
      text.textContent = record.target?.sectionTitle || record.target?.sectionKey || "";
      return text;
    }

    const select = document.createElement("select");
    select.title = "选择写入哪个模块";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "选择模块…";
    select.append(placeholder);
    for (const section of PROFILE_SCHEMA) {
      const option = document.createElement("option");
      option.value = section.key;
      option.textContent = section.title;
      select.append(option);
    }
    select.value = record.target?.sectionKey || "";
    select.addEventListener("change", () => {
      const nextKey = select.value;
      const resolved = resolveLearningAddTarget(nextKey, record.fieldLabel, null);
      record.action = resolved.action;
      record.target = resolved.target;
      record.selected = resolved.selected;
      record.userAdjusted = true;
      renderLearningPanel();
      scheduleLearningSync();
    });
    return select;
  }

  function renderLearningItemControl(record) {
    const sectionKey = record.target?.sectionKey || "";
    if (record.action === "update") {
      const text = document.createElement("span");
      text.textContent = record.target?.itemTitle || `第 ${Number(record.target?.itemIndex) + 1} 条`;
      return text;
    }

    const items = getProfileSectionItems(sectionKey);
    const schemaSection = getSchemaSection(sectionKey);
    const select = document.createElement("select");
    select.title = "选择写入哪一条";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "选择归属…";
    select.append(placeholder);
    items.forEach((_item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = describeProfileItem(sectionKey, index);
      select.append(option);
    });
    const fresh = document.createElement("option");
    fresh.value = "-1";
    fresh.textContent = `新增一条${schemaSection?.itemLabel || ""}`;
    select.append(fresh);
    select.value = Number.isInteger(record.target?.itemIndex) ? String(record.target.itemIndex) : "";
    select.addEventListener("change", () => {
      const value = select.value;
      record.target.itemIndex = value === "" ? null : Number(value);
      record.target.itemTitle = value === "" || value === "-1" ? "" : describeProfileItem(sectionKey, Number(value));
      record.selected = isLearningRecordReady(record);
      record.userAdjusted = true;
      renderLearningPanel();
      scheduleLearningSync();
    });
    return select;
  }

  function ignoreLearningRecord(id) {
    const record = findLearningRecord(id);
    if (record && learningBaseline) {
      const entry = learningBaseline.fields.get(record.fieldId);
      if (entry) {
        entry.ignoredValue = record.newValue;
      }
    }
    const wasOtherPage = learningOtherRecords.some((item) => item.id === id);
    removeLearningRecord(id, { silent: true });
    if (wasOtherPage) {
      void sendRuntimeMessage({ type: "OJAF_DISCARD_LEARNING_RECORDS", payload: { ids: [id] } }).catch(() => {});
    }
    commitLearningRecords();
  }

  async function discardAllLearningRecords() {
    if (learningBaseline) {
      for (const record of learningRecords) {
        const entry = learningBaseline.fields.get(record.fieldId);
        if (entry) {
          entry.ignoredValue = record.newValue;
        }
      }
    }
    learningRecords = [];
    learningOtherRecords = [];
    try {
      await sendRuntimeMessage({ type: "OJAF_DISCARD_LEARNING_RECORDS", payload: { all: true } });
      setLearningPanelStatus("已忽略全部修改记录。");
    } catch (error) {
      setLearningPanelStatus(`清理失败：${formatErrorMessage(error)}`, true);
    }
    renderFloatingStatus();
    renderLearningPanel();
  }

  async function applySelectedLearningRecords() {
    const selected = getAllLearningRecords().filter((record) => record.selected && isLearningRecordReady(record));
    if (selected.length === 0) {
      setLearningPanelStatus("请先勾选要写入的项。", true);
      return;
    }

    learningPanelBusy = true;
    renderLearningPanel();
    setLearningPanelStatus(`正在写入 ${selected.length} 项到本机资料库...`);
    try {
      const result = await sendRuntimeMessage({ type: "OJAF_APPLY_LEARNING", payload: { records: selected } });
      const appliedIds = new Set(Array.isArray(result?.appliedIds) ? result.appliedIds : []);
      if (learningBaseline) {
        for (const record of learningRecords) {
          if (!appliedIds.has(record.id)) {
            continue;
          }
          const entry = learningBaseline.fields.get(record.fieldId);
          if (entry) {
            entry.baselineValue = record.newValue;
            if (entry.candidate) {
              entry.candidate = { ...entry.candidate, value: record.newValue };
              entry.filled = true;
            }
            const element = findFieldElement(entry.field);
            if (element) {
              markElement(element, "filled", `已写回资料库: ${record.target?.sectionTitle || ""} / ${record.target?.label || record.fieldLabel}`);
            }
          }
        }
      }
      learningRecords = learningRecords.filter((record) => !appliedIds.has(record.id));
      learningOtherRecords = learningOtherRecords.filter((record) => !appliedIds.has(record.id));
      await refreshCurrentProfile({ force: true });
      const errorNote = Array.isArray(result?.errors) && result.errors.length > 0 ? `，${result.errors.length} 项失败` : "";
      setLearningPanelStatus(`已写入 ${result?.applied || 0} 项到本机资料库${errorNote}。设置页会自动刷新显示（若已打开且有未保存修改，请先处理提示）。`, Boolean(errorNote));
    } catch (error) {
      setLearningPanelStatus(`写入失败：${formatErrorMessage(error)}`, true);
    } finally {
      learningPanelBusy = false;
      renderFloatingStatus();
      renderLearningPanel();
      scheduleLearningSync();
    }
  }

  async function aiClassifyLearningRecords(options = {}) {
    const targets = getAllLearningRecords().filter(
      (record) => (record.action === "unresolved" || record.action === "custom") && !(options.auto && record.aiClassified)
    );
    if (targets.length === 0) {
      return;
    }

    const catalogFields = [];
    const catalogSections = [];
    for (const section of PROFILE_SCHEMA) {
      const sectionFields = section.fields.map((label, index) => ({
        path: `schema.${section.key}.${index}`,
        label: `${section.title} / ${label}`,
        aliases: [label, section.title]
      }));
      catalogFields.push(...sectionFields);
      catalogSections.push({ key: section.key, title: section.title, fields: sectionFields });
    }

    const scan = {
      url: location.href,
      hostname: location.hostname,
      title: normalizeText(document.title, 120),
      fields: targets.map((record) => ({
        fieldId: record.id,
        type: "text",
        label: record.fieldLabel,
        placeholder: "",
        required: false,
        section: record.fieldCategory || "",
        nearbyText: [record.fieldCategory, record.fieldLabel].filter(Boolean).join(" "),
        options: []
      }))
    };

    learningPanelBusy = true;
    renderLearningPanel();
    setLearningPanelStatus(options.auto ? "正在自动用 AI 归类未匹配字段，只发送字段名称..." : "正在用 AI 归类未匹配字段，只发送字段名称...");
    targets.forEach((record) => {
      record.aiClassified = true;
    });
    try {
      const response = await sendRuntimeMessage({
        type: "OJAF_MAP_FIELDS",
        payload: { scan, profileCatalog: { sections: catalogSections, fields: catalogFields } }
      });
      let resolved = 0;
      for (const mapping of Array.isArray(response?.mappings) ? response.mappings : []) {
        const match = /^schema\.([^.]+)\.(\d+)$/.exec(String(mapping?.sourcePath || ""));
        const record = findLearningRecord(mapping?.fieldId);
        if (!match || !record || Number(mapping.confidence || 0) < 0.5) {
          continue;
        }
        const schemaSection = getSchemaSection(match[1]);
        const label = schemaSection?.fields?.[Number(match[2])];
        if (!schemaSection || !label) {
          continue;
        }
        const isRepeat = schemaSection.kind === "repeat";
        const keepItem = record.target?.sectionKey === schemaSection.key && Number.isInteger(record.target?.itemIndex);
        let itemIndex = isRepeat ? (keepItem ? record.target.itemIndex : resolveLearningItemIndex(null, schemaSection.key)) : null;

        // AI says the page label names schema field `label`. If that field already holds the
        // typed value somewhere in the section, this is a synonym label, not a new value.
        const normalizedValue = normalizeComparableValue(record.newValue);
        const sameValueEntry = getCurrentProfileEntries().find(
          (entry) => entry?.hasValue && getEntrySectionKey(entry) === schemaSection.key && normalizeMatchKey(entry.label) === normalizeMatchKey(label) && normalizeComparableValue(entry.value) === normalizedValue
        );
        if (sameValueEntry) {
          itemIndex = isRepeat ? getEntryItemIndex(sameValueEntry) : null;
          record.action = "alias";
          record.aliasOf = label;
        } else {
          record.action = "add";
          record.aliasOf = "";
        }
        record.target = {
          sectionKey: schemaSection.key,
          sectionTitle: schemaSection.title,
          sectionKind: isRepeat ? "repeat" : "simple",
          kind: record.action === "alias" ? "custom" : "values",
          label: record.action === "alias" ? normalizeText(record.fieldLabel, 80) : label,
          itemIndex,
          itemLabel: schemaSection.itemLabel || "",
          itemTitle: Number.isInteger(itemIndex) && itemIndex >= 0 ? describeProfileItem(schemaSection.key, itemIndex) : ""
        };
        record.selected = isLearningRecordReady(record);
        record.userAdjusted = true;
        resolved += 1;
      }
      setLearningPanelStatus(
        resolved > 0
          ? `${options.auto ? "已自动用 AI 归类" : "AI 已归类"} ${resolved} 项，请检查后写入。`
          : options.auto ? "AI 未能归类剩余字段，可以手动选择模块。" : "AI 没有给出可用的归类，可以手动选择模块。",
        resolved === 0 && !options.auto
      );
    } catch (error) {
      setLearningPanelStatus(`AI 归类失败：${formatErrorMessage(error)}`, true);
    } finally {
      learningPanelBusy = false;
      renderLearningPanel();
      scheduleLearningSync();
    }
  }

  function setNativeValue(element, value) {
    const stringValue = value == null ? "" : String(value);
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : element instanceof HTMLInputElement
            ? HTMLInputElement.prototype
            : null;

    const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, "value") : null;
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, stringValue);
    } else {
      element.value = stringValue;
    }

    if (element.setAttribute && element instanceof HTMLInputElement) {
      element.setAttribute("value", stringValue);
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setCheckboxOrRadio(element, value) {
    if (element instanceof HTMLInputElement && element.type === "radio") {
      const target = normalizeChoiceValue(value, getChoiceLabelText(element));
      const group = element.name ? Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(element.name)}"]`)) : [element];
      const matched = group.find((radio) => choiceTextMatches(getChoiceLabelText(radio), target) || choiceTextMatches(radio.value || "", target));
      if (matched) {
        matched.click();
        matched.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }

    const normalized = String(value).trim().toLowerCase();
    const shouldCheck = ["true", "yes", "是", "1", "checked", "on"].includes(normalized);
    element.checked = shouldCheck;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ---- Opt-in AI option matching (B). Only low-sensitivity choice fields ever reach the API. ----
  const AI_VALUE_ALLOWED_LABEL = /学历|学位|学习形式|学习方式|教育类型|培养方式|学校类别|录取批次|政治面貌|婚姻|民族|性别|国籍|血型|健康|证件类型|证件号码类型|工作年限|职称|奖励等级|奖惩层级|奖惩类型|掌握程度|听说|读写|刊物层级|专利类型|外语种类|语种|期望工作城市|面试城市|意向城市|工作城市|工作地|城市|地点|现居住城市|是否|有无|能否|接受|服从|简历来源|信息来源|户籍类型|升学类型|实践方式|学制|年级|在读|全日制|类型|类别|状态|形式|方式|等级|程度|层级/;
  const AI_VALUE_DENIED_LABEL = /姓名|电话|手机|邮箱|邮件|证件号码$|身份证号|护照|地址|微信|QQ|学号|编号|号码|联系人|证明人|银行|密码|薪资|收入|工资|籍贯|户籍$|生源地|出生|家庭|亲属|紧急/;

  function isAiValueMatchingAllowed(label) {
    const text = normalizeText(label, 80);
    return Boolean(text) && !AI_VALUE_DENIED_LABEL.test(text) && AI_VALUE_ALLOWED_LABEL.test(text);
  }

  async function aiPickOption(field, candidate, value, optionTexts) {
    if (!aiValueMatchingEnabled || !currentApiUsable) {
      return null;
    }
    const label = candidate?.fieldLabel || field?.inferredLabel || inferFieldLabel(field) || "";
    const sourceLabel = candidate?.sourceLabel || "";
    if (!isAiValueMatchingAllowed(label) && !isAiValueMatchingAllowed(sourceLabel)) {
      return null;
    }
    const options = [...new Set((optionTexts || []).map((text) => normalizeText(text, 120)).filter((text) => text && !LEARNING_PLACEHOLDER_VALUE.test(text)))];
    if (options.length < 2 || options.length > 80 || !normalizeText(value)) {
      return null;
    }
    const cacheKey = `${normalizeMatchKey(label)}|${normalizeText(value, 200)}|${options.join("\u0001")}`;
    if (aiOptionMatchCache.has(cacheKey)) {
      return aiOptionMatchCache.get(cacheKey);
    }
    let result = null;
    try {
      const response = await sendRuntimeMessage({
        type: "OJAF_MATCH_OPTION",
        payload: { fieldLabel: label, value, options, context: normalizeText(field?.section || "", 120) }
      });
      if (response && Number(response.index) >= 0 && Number(response.confidence || 0) >= 0.6) {
        result = { option: response.option, confidence: Number(response.confidence), reason: response.reason || "" };
      }
    } catch {
      result = null;
    }
    aiOptionMatchCache.set(cacheKey, result);
    return result;
  }

  function setSelectValue(element, value) {
    const stringValue = String(value || "").trim();
    const normalizedTarget = normalizeChoiceLabel(stringValue);
    const matchedOption = Array.from(element.options).find((option) => {
      const optionValue = normalizeText(option.value || "", 120);
      const optionLabel = normalizeText(option.textContent || "", 120);
      return (
        option.value === stringValue ||
        optionLabel === stringValue ||
        normalizeChoiceLabel(optionValue) === normalizedTarget ||
        normalizeChoiceLabel(optionLabel) === normalizedTarget ||
        optionLabel.includes(stringValue) ||
        stringValue.includes(optionLabel)
      );
    });

    if (matchedOption) {
      setNativeValue(element, matchedOption.value);
      return true;
    }

    setNativeValue(element, stringValue);
    return false;
  }

  function setContentEditableValue(element, value) {
    element.focus();
    element.textContent = value == null ? "" : String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function findElementByCssPath(cssPath) {
    if (!cssPath) {
      return null;
    }

    try {
      const element = document.querySelector(cssPath);
      return element && isVisible(element) ? element : null;
    } catch {
      return null;
    }
  }

  function scoreControlForField(element, field) {
    if (!field || !element) {
      return 0;
    }

    const nearbyText = getNearbyText(element);
    const sectionText = getSectionText(element);
    const currentValue = normalizeText(element.value || element.textContent || "", 180);
    let score = 0;

    score += textMatchScore(nearbyText, field.label) * 4;
    score += textMatchScore(nearbyText, field.nearbyText) * 2;
    score += textMatchScore(sectionText, field.section) * 2;
    score += textMatchScore(element.getAttribute("placeholder"), field.placeholder) * 3;
    score += textMatchScore(element.getAttribute("name"), field.name) * 3;
    score += textMatchScore(element.getAttribute("id"), field.id) * 3;
    score += textMatchScore(currentValue, field.value) * 2;

    if (field.type && getControlType(element) === field.type) {
      score += 2;
    }

    return score;
  }

  function findControlByMetadata(field) {
    const controls = collectVisibleControls();
    let best = null;
    let bestScore = 0;

    for (const element of controls) {
      const score = scoreControlForField(element, field);
      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }

    return bestScore >= 8 ? best : null;
  }

  function findFieldElement(field) {
    if (!field) {
      return null;
    }

    if (field.fieldId) {
      const direct = document.querySelector(`[${FIELD_ATTR}="${CSS.escape(field.fieldId)}"]`);
      if (direct && isVisible(direct)) {
        return direct;
      }
    }

    const cssPathMatch = findElementByCssPath(field.cssPath);
    if (cssPathMatch && cssPathMatch.matches(CONTROL_SELECTOR)) {
      return cssPathMatch;
    }

    return findControlByMetadata(field);
  }

  function scoreRootForField(root, field) {
    const text = getTextWithoutControls(root);
    let score = 0;

    score += textMatchScore(text, field?.label) * 4;
    score += textMatchScore(text, field?.nearbyText) * 2;
    score += textMatchScore(text, field?.section) * 3;
    score += textMatchScore(text, field?.placeholder) * 2;
    score += textMatchScore(text, field?.value) * 1;

    if (looksLikeEditableSummary(text)) {
      score += 2;
    }

    return score;
  }

  function findEditButtonForField(field) {
    const buttons = Array.from(
      document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')
    ).filter((button) => isActionControl(button, getAdapterActionLabels("edit")));

    let best = null;
    let bestScore = 0;

    for (const button of buttons) {
      const root = findActionRoot(button);
      if (!root) {
        continue;
      }

      const score = scoreRootForField(root, field);
      if (score > bestScore) {
        best = button;
        bestScore = score;
      }
    }

    return bestScore >= 8 ? best : null;
  }

  async function openEditScopeForField(field) {
    const button = findEditButtonForField(field);
    if (!button) {
      return false;
    }

    button.setAttribute(EDIT_ATTEMPT_ATTR, "true");
    clickActionElement(button);
    await sleep(180);
    return true;
  }

  function fieldNeedsEditMode(element) {
    if (!element) {
      return true;
    }

    return Boolean(element.disabled || element.readOnly || element.getAttribute("aria-readonly") === "true");
  }

  async function resolveFieldElement(field) {
    let element = findFieldElement(field);

    if (!element || fieldNeedsEditMode(element)) {
      const opened = await openEditScopeForField(field);
      if (opened) {
        element = findFieldElement(field);
      }
    }

    return element;
  }

  async function handleContentMessage(message) {
    if (message.type === "OJAF_SHOW_PROFILE_PANEL") {
      showProfilePanel();
      renderProfilePanel();
      return { visible: true };
    }

    if (message.type === "OJAF_START_AUTOFILL") {
      return runOneClickAutofill();
    }

    if (message.type === "OJAF_GET_RUNTIME_STATE") {
      return getAutofillRuntimeState();
    }

    if (message.type === "OJAF_GET_DEBUG_SNAPSHOT") {
      return getAutofillDebugSnapshot();
    }

    if (message.type === "OJAF_CLEAR_MARKS") {
      clearMarks();
      return {};
    }

    if (message.type === "OJAF_OPEN_LEARNING_PANEL") {
      return openLearningPanel();
    }

    return undefined;
  }

  const messageHandler = (message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string" || !message.type.startsWith("OJAF_")) {
      return undefined;
    }

    handleContentMessage(message)
      .then((data) => {
        if (data === undefined) {
          sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
          return;
        }
        sendResponse({ ok: true, data });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      });

    return true;
  };

  if (window.__OJAF_AUTOFILL_MESSAGE_HANDLER__) {
    chrome.runtime.onMessage.removeListener(window.__OJAF_AUTOFILL_MESSAGE_HANDLER__);
  }
  window.__OJAF_AUTOFILL_MESSAGE_HANDLER__ = messageHandler;
  chrome.runtime.onMessage.addListener(messageHandler);
})();
