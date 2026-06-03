export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.2.1",
    date: "2026.06.03",
    changes: [
      "新增了用户自定义标签功能,现在可以对自定义上传的歌曲编辑标签,并选择特定的标签进行练习",
      "修复了上传单声道音频时只有左侧耳机有声音的问题",
      "修复了使用频点的悬浮面板的监听按钮会出现频点跳动的问题",
      "优化了网页背景以及关卡卡片显示特效以优化性能"
    ]
  },
  {
    version: "v1.1.0",
    date: "2026.05.23",
    changes: [
      "First Release",
      "实现所有基本功能.",
      "添加用户简介、关卡设计以及计分算法",
      "优化音频路由以及立体声模式表现",
      "添加了自由训练关卡"
    ]
  }
];
