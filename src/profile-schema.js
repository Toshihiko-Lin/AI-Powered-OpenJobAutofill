// Shared resume profile schema: section keys, titles and the fixed field labels used by the
// settings editor, resume parsing and the learn-from-edits flow. Plain script so it can be
// loaded by options.html and injected ahead of content.js.
(() => {
  if (globalThis.OJAF_PROFILE_SCHEMA) {
    return;
  }

  globalThis.OJAF_PROFILE_SCHEMA = [
    {
      key: "basic",
      title: "基本信息",
      kind: "simple",
      fields: [
        "姓名",
        "姓",
        "名",
        "英文名",
        "姓（拼音）",
        "名（拼音）",
        "性别",
        "出生日期",
        "民族",
        "国籍（国家或地区）",
        "电话",
        "邮箱",
        "微信号",
        "QQ",
        "证件号码类型",
        "证件号码",
        "政治面貌",
        "取得政治面貌时间",
        "婚姻状况",
        "户籍",
        "户籍类型",
        "籍贯",
        "生源地",
        "现居住城市",
        "现居住详细地址",
        "通讯地址",
        "邮政编码",
        "人事档案所在单位",
        "身高",
        "体重",
        "血型",
        "健康状况",
        "特长",
        "兴趣爱好",
        "高考时间",
        "高考分数",
        "高考科目",
        "工作年限",
        "专业技术职称",
        "紧急联系人",
        "紧急联系人电话",
        "与紧急联系人关系"
      ]
    },
    {
      key: "intention",
      title: "求职意向",
      kind: "repeat",
      itemLabel: "求职意向",
      defaultItems: 1,
      fields: [
        "意向岗位",
        "预计入职时间",
        "当前薪资",
        "期望工作城市",
        "期望薪资",
        "面试城市",
        "是否接受调剂"
      ]
    },
    {
      key: "education",
      title: "教育经历",
      kind: "repeat",
      itemLabel: "教育经历",
      defaultItems: 1,
      fields: [
        "开始时间",
        "结束时间",
        "学校",
        "专业",
        "学号",
        "学制",
        "城市",
        "学位",
        "学历",
        "学习形式",
        "学校类别",
        "录取批次",
        "学院（院系）",
        "培养方式",
        "专业描述",
        "专业课程",
        "研究方向",
        "毕业论文",
        "成绩",
        "班级排名",
        "专业排名",
        "学历证书编号",
        "学位证书编号",
        "辅导员姓名",
        "辅导员联系方式",
        "是否为海外教育经历",
        "升学类型",
        "考试分数",
        "是否有转学经历"
      ]
    },
    {
      key: "internship",
      title: "实习经历",
      kind: "repeat",
      itemLabel: "实习经历",
      defaultItems: 1,
      fields: [
        "开始时间",
        "结束时间",
        "公司",
        "部门",
        "行业",
        "地点",
        "工资",
        "职位",
        "工作内容",
        "工作成果",
        "证明人姓名",
        "证明人职位",
        "证明人联系方式",
        "离职原因"
      ]
    },
    {
      key: "work",
      title: "工作经历",
      kind: "repeat",
      itemLabel: "工作经历",
      defaultItems: 1,
      fields: [
        "开始时间",
        "结束时间",
        "公司",
        "部门",
        "行业",
        "地点",
        "工资",
        "职位",
        "工作内容",
        "工作成果",
        "证明人姓名",
        "证明人职位",
        "证明人联系方式",
        "离职原因"
      ]
    },
    {
      key: "performance",
      title: "绩效考核",
      kind: "repeat",
      itemLabel: "绩效考核",
      defaultItems: 1,
      fields: [
        "考核年度",
        "绩效考核等级",
        "年度绩效排名",
        "绩效证明人",
        "绩效证明人联系方式",
        "绩效说明"
      ]
    },
    {
      key: "project",
      title: "项目经历/实践活动",
      kind: "repeat",
      itemLabel: "项目经历",
      defaultItems: 1,
      fields: [
        "开始时间",
        "结束时间",
        "职位",
        "部门",
        "项目名称",
        "参与人数",
        "项目内容",
        "实践方式",
        "本人职责",
        "项目成果",
        "项目链接",
        "证明人姓名",
        "证明人职位",
        "证明人联系方式"
      ]
    },
    {
      key: "student",
      title: "干部任职经历（在校职务）",
      kind: "repeat",
      itemLabel: "干部任职经历",
      defaultItems: 1,
      fields: [
        "开始时间",
        "结束时间",
        "组织名称",
        "职位",
        "工作内容",
        "本人职责"
      ]
    },
    {
      key: "awards",
      title: "奖惩情况",
      kind: "repeat",
      itemLabel: "奖惩",
      defaultItems: 1,
      fields: [
        "奖惩时间",
        "奖惩名称",
        "颁奖单位",
        "奖励等级",
        "奖惩描述",
        "证明人"
      ]
    },
    {
      key: "language",
      title: "外语能力",
      kind: "repeat",
      itemLabel: "外语能力",
      defaultItems: 1,
      fields: [
        "获得时间",
        "外语种类",
        "证书名称（技能名称）",
        "成绩",
        "掌握程度",
        "听说能力",
        "读写能力",
        "有效期"
      ]
    },
    {
      key: "computer",
      title: "计算机技能（IT技能）",
      kind: "repeat",
      itemLabel: "计算机技能",
      defaultItems: 1,
      fields: [
        "获得时间",
        "证书名称（技能名称）",
        "成绩",
        "掌握程度"
      ]
    },
    {
      key: "certificates",
      title: "证书",
      kind: "repeat",
      itemLabel: "证书",
      defaultItems: 1,
      fields: [
        "证书获得时间",
        "证书名称（技能名称）",
        "证书编号",
        "授予单位",
        "证书说明"
      ]
    },
    {
      key: "family",
      title: "家庭情况",
      kind: "repeat",
      itemLabel: "家庭情况",
      defaultItems: 2,
      fields: [
        "姓名",
        "关系",
        "出生日期",
        "电话",
        "公司",
        "职位",
        "政治面貌",
        "联系地址"
      ]
    },
    {
      key: "training",
      title: "培训经历",
      kind: "repeat",
      itemLabel: "培训经历",
      defaultItems: 1,
      fields: [
        "开始时间",
        "结束时间",
        "培训名称",
        "培训机构",
        "培训地点",
        "培训课程",
        "培训获得证书",
        "培训内容"
      ]
    },
    {
      key: "papers",
      title: "论文和著作",
      kind: "repeat",
      itemLabel: "论文和著作",
      defaultItems: 1,
      fields: [
        "发表时间",
        "刊物名称",
        "刊物层级",
        "论文名称",
        "论文描述"
      ]
    },
    {
      key: "patent",
      title: "专利",
      kind: "repeat",
      itemLabel: "专利",
      defaultItems: 1,
      fields: [
        "发表时间",
        "专利名称",
        "专利编号",
        "专利类型",
        "专利成果"
      ]
    },
    {
      key: "self",
      title: "自我描述",
      kind: "simple",
      fields: [
        "自我描述",
        "自我评价"
      ]
    },
    {
      key: "declarations",
      title: "有关声明",
      kind: "simple",
      fields: [
        "是否存在亲属在应聘单位工作",
        "是否患有影响工作的疾病",
        "是否存在不良行为记录",
        "是否享有境外长期或永久居留权",
        "是否拥有外国国籍",
        "是否拥有境外永久居留权",
        "是否同意背景调查",
        "本人声明以上填写内容与事实完全相符"
      ]
    },
    {
      key: "other",
      title: "其他信息",
      kind: "simple",
      fields: [
        "受到奖励/学术成果",
        "社会/校园活动",
        "爱好及专长",
        "招聘信息来源",
        "GitHub",
        "个人主页"
      ]
    }
  ];
})();
