import { ParticleField } from './particles.js';
import { TwinMapSceneCityStats } from './map-scene-city-stats.js';
import { TwinMapSceneAppealMap } from './map-scene-appeal-map.js';
import { TwinMapSceneSpecialAnalysis } from './map-scene-special-analysis.js';

const particleCanvas = document.querySelector('#particle-canvas');
const clock = document.querySelector('#clock');
const stageRoot = document.querySelector('.screen-stage');
const topicTabs = Array.from(document.querySelectorAll('[data-topic-tab]'));
const topicContents = Array.from(document.querySelectorAll('[data-topic-content]'));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const CITY_TOPICS = ['city-stats', 'appeal-map', 'special-analysis'];

let activeTopic = 'city-stats';

const CITY_PANEL_STATE = Object.fromEntries(
  CITY_TOPICS.map((topic) => [topic, { isOpen: false, cityName: '' }])
);
const ORDERS_WORKBENCH_STATE = Object.fromEntries(
  CITY_TOPICS.map((topic) => [topic, { isOpen: false }])
);
const TIME_FILTER_OPTIONS = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: '30d', label: '近30日' },
];
const TIME_FILTER_DEFAULT = TIME_FILTER_OPTIONS[0].value;
const TIME_FILTER_STATE = Object.fromEntries(['province-warning', ...CITY_TOPICS].map((topic) => [topic, TIME_FILTER_DEFAULT]));

const particleField = particleCanvas ? new ParticleField(particleCanvas) : null;
const twinMapScenes = new Map();

const BUSINESS_DATA = {
  overview: {
    hero: { label: '今日受理事件', value: 18752, unit: '件' },
    compare: ['较昨日 +6.8%', '较上周同期 +2.1%'],
    trend: [3200, 4860, 6120, 7440, 9860, 11240, 13560, 15220, 16540, 17280, 18060, 18752],
    basicInfo: [
      { label: '今日来电量', value: 18752, unit: '件', yoy: '同比 +6.8%', qoq: '环比 +2.1%' },
      { label: '今日工单量', value: 15231, unit: '件', yoy: '同比 +5.4%', qoq: '环比 +3.2%' },
      { label: '今日办结量', value: 14028, unit: '件', yoy: '同比 +4.1%', qoq: '环比 +1.8%' },
    ],
    stats: [
      { label: '已派遣', value: 15231, unit: '件', delta: '环比 +5.4%', format: 'integer' },
      { label: '已办结', value: 14028, unit: '件', delta: '同比 +4.1%', format: 'integer' },
      { label: '办结率', value: 98.6, unit: '%', delta: '较昨日 +0.8%', format: 'decimal1' },
      { label: '超时工单', value: 287, unit: '件', delta: '较昨日 -18', format: 'integer', deltaClass: 'down' },
    ],
  },
  hotlineTrend: {
    hero: { label: '当前小时受理量', value: 324, unit: '件' },
    compare: ['环比上一小时 +12.4%', '较昨日同期 +5.6%'],
    trend24h: [42, 38, 36, 30, 28, 35, 48, 56, 64, 58, 72, 86, 91, 96, 88, 84, 79, 76, 82, 94, 102, 97, 89, 78],
    flowTrend: [58, 61, 66, 72, 69, 74, 82, 88, 91, 96, 92, 98, 103, 108, 112, 109, 116, 121, 118, 126, 132, 128, 134, 140],
    stats: [
      { label: '接通率', value: 96.4, unit: '%', delta: '较昨日 +0.9%', format: 'decimal1' },
      { label: '平均等待', value: 18, unit: '秒', delta: '环比 -3 秒', format: 'integer', deltaClass: 'down' },
      { label: '转派率', value: 82.1, unit: '%', delta: '较昨日 +1.6%', format: 'decimal1' },
    ],
  },
  flowSummary: [
    { label: '今日流转', value: 1248, unit: '件', format: 'integer' },
    { label: '待签收', value: 46, unit: '件', format: 'integer' },
    { label: '办理中', value: 318, unit: '件', format: 'integer' },
    { label: '已办结', value: 884, unit: '件', format: 'integer' },
  ],
  workorderFlow: [
    {
      title: '噪声扰民工单待街道签收',
      area: '天河区 · 石牌街道',
      source: '12345热线',
      dept: '属地街道办',
      status: '待签收',
      elapsed: '08分',
      level: 'medium',
    },
    {
      title: '井盖破损已转派市政养护中心',
      area: '越秀区 · 北京街道',
      source: '网格上报',
      dept: '市政设施科',
      status: '处理中',
      elapsed: '16分',
      level: 'normal',
    },
    {
      title: '积水点告警已升级区防汛办',
      area: '海珠区 · 新港街道',
      source: '物联感知',
      dept: '区防汛办',
      status: '超时预警',
      elapsed: '27分',
      level: 'high',
    },
    {
      title: '路灯故障处置结果已回传',
      area: '白云区 · 同和街道',
      source: '随手拍',
      dept: '照明管理所',
      status: '已办结',
      elapsed: '42分',
      level: 'normal',
    },
  ],
  districtRanking: {
    summary: {
      label: '今日热点事件总量',
      value: 16668,
      unit: '件',
      compare: '较昨日 +9.2%',
      note: 'TOP3 城市占全省 64.8%',
    },
    items: [
      { name: '广州市', count: 4286, delta: '12.6%', progress: 100, metric: '占比 25.7%' },
      { name: '深圳市', count: 3942, delta: '10.8%', progress: 92, metric: '占比 23.6%' },
      { name: '佛山市', count: 2618, delta: '8.4%', progress: 61, metric: '占比 15.7%' },
      { name: '东莞市', count: 2344, delta: '7.1%', progress: 55, metric: '占比 14.1%' },
      { name: '珠海市', count: 1826, delta: '5.9%', progress: 43, metric: '占比 11.0%' },
      { name: '中山市', count: 1652, delta: '4.8%', progress: 39, metric: '占比 9.9%' },
    ],
  },
  riskSummary: {
    total: 53,
    compare: '较昨日 +4 件',
    counts: [
      { label: '未处置', value: 9, unit: '件', format: 'integer' },
      { label: '处置中', value: 21, unit: '件', format: 'integer' },
      { label: '已反馈', value: 23, unit: '件', format: 'integer' },
    ],
    severity: [6, 21, 26],
  },
  risks: [
    {
      title: '海珠区内涝点位持续积水',
      level: 'high',
      area: '海珠区 · 新港街道',
      source: '视频AI+积水传感',
      dept: '区防汛办',
      duration: '12分钟',
      status: '已联动处置',
    },
    {
      title: '燃气压力异常告警未消退',
      level: 'medium',
      area: '白云区 · 嘉禾街道',
      source: '燃气监测平台',
      dept: '燃气集团抢修队',
      duration: '18分钟',
      status: '现场核查中',
    },
    {
      title: '主干道拥堵指数持续升高',
      level: 'medium',
      area: '天河区 · 珠江新城',
      source: '视频感知平台',
      dept: '交警支队',
      duration: '24分钟',
      status: '信号配时调整',
    },
    {
      title: '消防通道占用告警复发',
      level: 'low',
      area: '番禺区 · 市桥街道',
      source: '网格巡查',
      dept: '属地综合执法队',
      duration: '31分钟',
      status: '责令整改',
    },
  ],
  departmentSummary: [
    { label: '联动部门', value: 12, unit: '个', format: 'integer' },
    { label: '在线视频点位', value: 4286, unit: '路', format: 'integer' },
    { label: '待命队伍', value: 36, unit: '支', format: 'integer' },
  ],
  distribution: [
    { label: '咨询', value: 32, color: '#57b8ff' },
    { label: '投诉', value: 24, color: '#4de0d4' },
    { label: '求助', value: 18, color: '#8b9bff' },
    { label: '举报', value: 15, color: '#ffb561' },
    { label: '其他', value: 11, color: '#6b7f95' },
  ],
  provinceWarning: {
    workorderOverview: {
      acceptanceHero: {
        label: '受理工单总量', value: 28461, unit: '件', status: '稳定', compare: ['同比昨日 +7.2%', '环比上周 +3.8%'], format: 'integer',
      },
      acceptanceStats: [
        { label: '自动分拨率', value: 88.6, unit: '%', delta: '智能分拨提升', format: 'decimal1' },
        { label: '1 小时签收率', value: 92.4, unit: '%', delta: '同比 +1.2%', format: 'decimal1' },
        { label: '高频诉求', value: 4268, unit: '件', delta: '民生服务集中', format: 'integer' },
        { label: '跨层级流转', value: 318, unit: '件', delta: '较昨日 -12', deltaClass: 'steady', format: 'integer' },
      ],
      handlingHero: {
        label: '承办单办结率', value: 97.3, unit: '%', status: '良好', compare: ['同比昨日 +0.6%', '环比上周 +0.4%'], format: 'decimal1',
      },
      handlingStats: [
        { label: '办理中', value: 1842, unit: '件', delta: '重点盯办 76 件', format: 'integer' },
        { label: '已办结', value: 26519, unit: '件', delta: '闭环效率稳定', format: 'integer' },
        { label: '超时件', value: 126, unit: '件', delta: '较昨日 -18', deltaClass: 'steady', format: 'integer' },
        { label: '满意率', value: 96.1, unit: '%', delta: '回访反馈良好', format: 'decimal1' },
      ],
    },
    monitorStats: [
      { label: '预警总量', value: 684, unit: '条', delta: '较昨日 +4.8%', format: 'integer' },
      { label: '红色预警', value: 18, unit: '条', delta: '重点处置', format: 'integer' },
      { label: '超时处置', value: 42, unit: '件', delta: '较昨日 -6', deltaClass: 'steady', format: 'integer' },
      { label: '重点督办', value: 27, unit: '件', delta: '持续跟踪', format: 'integer' },
      { label: '联动部门', value: 21, unit: '个', delta: '省市区协同', format: 'integer' },
      { label: '在线监测源', value: 5136, unit: '路', delta: '全域感知', format: 'integer' },
    ],
    regionDistribution: [
      { label: '广州', value: 94, color: '#57b8ff' },
      { label: '深圳', value: 88, color: '#4de0d4' },
      { label: '佛山', value: 72, color: '#8b9bff' },
      { label: '东莞', value: 66, color: '#73d5ff' },
      { label: '珠海', value: 54, color: '#ffb561' },
      { label: '中山', value: 47, color: '#7ca8ff' },
    ],
    orderTypeDistribution: [
      { label: '城市管理', value: 26, color: '#57b8ff' },
      { label: '民生服务', value: 22, color: '#4de0d4' },
      { label: '公共安全', value: 18, color: '#8b9bff' },
      { label: '交通秩序', value: 17, color: '#ffb561' },
      { label: '生态环境', value: 17, color: '#6b7f95' },
    ],
    governanceShare: [
      { label: '噪声治理', value: 82, color: '#57b8ff' },
      { label: '积水整治', value: 74, color: '#4de0d4' },
      { label: '消防隐患', value: 61, color: '#8b9bff' },
      { label: '市容秩序', value: 57, color: '#ffb561' },
      { label: '道路设施', value: 49, color: '#73d5ff' },
      { label: '油烟扰民', value: 42, color: '#7ca8ff' },
    ],
    handlingUnitHotspots: [
      { unit: '省城运中心', issue: '重点区域噪声扰民持续高位', count: 128, ratio: '占全省 18.7%', note: '夜间消费带重复来电' },
      { unit: '省住建联动专班', issue: '老旧小区渗漏水与施工扰民聚集', count: 96, ratio: '占全省 14.1%', note: '雨后小区设施问题反弹' },
      { unit: '省应急处置中心', issue: '积水点和内涝告警联动频繁', count: 83, ratio: '占全省 12.1%', note: '强降雨时段告警抬升' },
      { unit: '省交通秩序专班', issue: '枢纽片区违停与拥堵问题集中', count: 74, ratio: '占全省 10.8%', note: '节假日客流触发热点' },
      { unit: '省生态环境专班', issue: '餐饮油烟和异味投诉升温', count: 69, ratio: '占全省 10.1%', note: '商圈夜经济区域集中' },
    ],
    provinceTrend: {
      labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      bars: [842, 886, 918, 964, 1022, 1084, 1146, 1218, 1266, 1338, 1402, 1486],
      line: [4.2, 5.1, 3.6, 4.8, 6.0, 5.4, 5.7, 6.2, 3.9, 5.6, 4.8, 6.1],
    },
    problemRanking: [
      { label: '噪声扰民', value: 4286 },
      { label: '道路积水', value: 3742 },
      { label: '消防通道占用', value: 3318 },
      { label: '油烟异味', value: 2964 },
      { label: '占道经营', value: 2581 },
      { label: '路灯故障', value: 2249 },
    ],
  },
  ordersWorkbench: {
    overview: [
      { label: '今日工单量', value: 15231, unit: '件', delta: '同比 +5.4%', format: 'integer' },
      { label: '受理率', value: 96.4, unit: '%', delta: '较昨日 +0.9%', format: 'decimal1' },
      { label: '办结率', value: 98.6, unit: '%', delta: '较昨日 +0.8%', format: 'decimal1' },
      { label: '办理中', value: 318, unit: '件', delta: '当前在办', format: 'integer' },
    ],
    channels: [
      { label: '12345', value: 46, color: '#57b8ff' },
      { label: '网格', value: 28, color: '#4de0d4' },
      { label: '视频AI', value: 16, color: '#8b9bff' },
      { label: '随手拍', value: 10, color: '#ffb561' },
    ],
    types: [
      { label: '咨询', value: 32, color: '#57b8ff' },
      { label: '投诉', value: 24, color: '#4de0d4' },
      { label: '求助', value: 18, color: '#8b9bff' },
      { label: '举报', value: 15, color: '#ffb561' },
      { label: '其他', value: 11, color: '#6b7f95' },
    ],
    trend: [820, 918, 1042, 1128, 1204, 1288, 1365, 1486, 1523, 1468, 1392, 1316],
    trendLabels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'],
    ranking: [
      { label: '广州市', value: 4286 },
      { label: '深圳市', value: 3942 },
      { label: '佛山市', value: 2618 },
      { label: '东莞市', value: 2344 },
      { label: '珠海市', value: 1826 },
    ],
  },
  workbench: {
    basicFinished: {
      summaryLabel: '今日办结量关联案件',
      accent: '已办结 14,028 件',
      items: [
        { id: 'bf-1', title: '城中村环境整治回访已完成', dept: '属地街道办', type: '城市管理', source: '12345热线', area: '天河区 · 石牌街道', status: '已办结', statusTone: 'complete', time: '09:12', elapsed: '闭环 18分', level: 'high', detail: { nature: '民生诉求', category: '城市管理', subCategory: '环境整治', code: 'GD-20260528-0101', caseStatus: '已办结', source: '12345热线', complainedParty: '石牌街城中村物业', responsibleParty: '属地街道办', reportTime: '2026-05-28 08:54', location: '天河区石牌街道临江片区', address: '天河区石牌街临江中路 18 号周边', description: '群众反映城中村周边堆物和卫生死角反复出现，已完成清运和现场复核。', images: ['现场回传 A', '整治前对比', '整治后复核', '街道签收'] } },
        { id: 'bf-2', title: '道路积水工单处置结果已回传', dept: '区防汛办', type: '应急处置', source: '视频AI', area: '海珠区 · 新港街道', status: '已办结', statusTone: 'complete', time: '09:05', elapsed: '闭环 26分', level: 'medium', detail: { nature: '应急事件', category: '防汛排涝', subCategory: '道路积水', code: 'GD-20260528-0102', caseStatus: '已办结', source: '视频AI', complainedParty: '新港街市政路段', responsibleParty: '区防汛办', reportTime: '2026-05-28 08:39', location: '海珠区新港街道江湾路口', address: '海珠区新港中路与江湾路交叉口', description: '视频巡检识别路面积水，现场排水完成后已回传处置结果并销案。', images: ['积水识别', '现场抽排', '水位恢复', '结果回传'] } },
        { id: 'bf-3', title: '公交站台秩序整治已确认销案', dept: '交通执法支队', type: '交通秩序', source: '随手拍', area: '越秀区 · 北京街道', status: '已办结', statusTone: 'complete', time: '08:48', elapsed: '闭环 14分', level: 'medium', detail: { nature: '公共秩序', category: '交通秩序', subCategory: '站台秩序', code: 'GD-20260528-0103', caseStatus: '已办结', source: '随手拍', complainedParty: '北京路公交站点周边摊点', responsibleParty: '交通执法支队', reportTime: '2026-05-28 08:28', location: '越秀区北京路公交站', address: '越秀区北京路步行街南侧公交停靠区', description: '群众上报站台周边占道影响候车秩序，执法人员到场清理并完成销案。', images: ['上报截图', '到场处置', '秩序恢复', '销案留痕'] } },
        { id: 'bf-4', title: '占道经营巡查工单已办结', dept: '城管执法队', type: '市容管理', source: '网格上报', area: '白云区 · 同和街道', status: '已办结', statusTone: 'complete', time: '08:31', elapsed: '闭环 22分', level: 'low', detail: { nature: '城市管理', category: '市容秩序', subCategory: '占道经营', code: 'GD-20260528-0104', caseStatus: '已办结', source: '网格上报', complainedParty: '同和街临街商户', responsibleParty: '城管执法队', reportTime: '2026-05-28 08:09', location: '白云区同和街道商业街', address: '白云区同和街同宝路 26 号附近', description: '网格员巡查发现占道经营影响通行，现场劝离后已恢复道路秩序。', images: ['巡查点位', '劝离现场', '清理后', '回传记录'] } },
        { id: 'bf-5', title: '井盖破损修复反馈已归档', dept: '市政养护中心', type: '市政设施', source: '12345热线', area: '番禺区 · 市桥街道', status: '已办结', statusTone: 'complete', time: '08:22', elapsed: '闭环 35分', level: 'medium', detail: { nature: '市政设施', category: '道路设施', subCategory: '井盖破损', code: 'GD-20260528-0105', caseStatus: '已办结', source: '12345热线', complainedParty: '市桥街社区道路设施', responsibleParty: '市政养护中心', reportTime: '2026-05-28 07:47', location: '番禺区市桥街道清河路段', address: '番禺区市桥街清河东路 118 号前', description: '群众反映井盖破损存在安全隐患，已完成更换并归档现场照片。', images: ['破损井盖', '维修作业', '更换完成', '归档截图'] } },
        { id: 'bf-6', title: '夜间噪声扰民处置已完成回访', dept: '属地综合执法队', type: '民生诉求', source: '热线回访', area: '荔湾区 · 花地街道', status: '已办结', statusTone: 'complete', time: '08:16', elapsed: '闭环 11分', level: 'high', detail: { nature: '民生诉求', category: '生态环境', subCategory: '噪声扰民', code: 'GD-20260528-0106', caseStatus: '已办结', source: '热线回访', complainedParty: '花地街夜市经营点', responsibleParty: '属地综合执法队', reportTime: '2026-05-28 08:01', location: '荔湾区花地街道夜间消费区', address: '荔湾区花地大道中段夜市区域', description: '夜间经营噪声引发重复来电，现场劝导后完成回访，群众表示满意。', images: ['夜市现场', '噪声点位', '劝导取证', '回访记录'] } },
        { id: 'bf-7', title: '小区消防通道占用已清理', dept: '消防救援站', type: '消防安全', source: '视频巡查', area: '黄埔区 · 文冲街道', status: '已办结', statusTone: 'complete', time: '07:58', elapsed: '闭环 19分', level: 'high', detail: { nature: '消防安全', category: '安全隐患', subCategory: '消防通道占用', code: 'GD-20260528-0107', caseStatus: '已办结', source: '视频巡查', complainedParty: '文冲街社区停车点', responsibleParty: '消防救援站', reportTime: '2026-05-28 07:39', location: '黄埔区文冲街道住宅区', address: '黄埔区文冲街道江北中路 12 号小区', description: '视频巡查发现消防通道被车辆占用，已通知挪车并完成复核。', images: ['占用抓拍', '到场核查', '清理完成', '复核照片'] } },
        { id: 'bf-8', title: '社区照明故障维修已反馈', dept: '照明管理所', type: '公共服务', source: '随手拍', area: '南沙区 · 黄阁镇', status: '已办结', statusTone: 'complete', time: '07:46', elapsed: '闭环 28分', level: 'low', detail: { nature: '公共服务', category: '市政照明', subCategory: '路灯故障', code: 'GD-20260528-0108', caseStatus: '已办结', source: '随手拍', complainedParty: '黄阁镇社区路段', responsibleParty: '照明管理所', reportTime: '2026-05-28 07:18', location: '南沙区黄阁镇主干道', address: '南沙区黄阁镇凤凰大道东 36 号周边', description: '居民上报夜间照明不足，检修后恢复供电并反馈处置结果。', images: ['报修位置', '检修过程', '照明恢复', '系统反馈'] } },
      ],
    },
    acceptanceRate: {
      summaryLabel: '受理率关联案件',
      accent: '受理率 96.4%',
      items: [
        { id: 'ar-1', title: '学校周边违停诉求已进入受理队列', dept: '交警支队', type: '交通秩序', source: '12345热线', area: '天河区 · 五山街道', status: '待分拨', statusTone: 'pending', time: '09:26', elapsed: '入池 02分', level: 'medium' },
        { id: 'ar-2', title: '沿街商铺油烟扰民已完成首响响应', dept: '生态环境分局', type: '生态环境', source: '网格上报', area: '海珠区 · 江南中街道', status: '已受理', statusTone: 'active', time: '09:18', elapsed: '受理 05分', level: 'high' },
        { id: 'ar-3', title: '供水异常波动告警已接入热线工单', dept: '水务集团客服', type: '公共服务', source: '物联感知', area: '白云区 · 嘉禾街道', status: '已受理', statusTone: 'active', time: '09:12', elapsed: '受理 04分', level: 'high' },
        { id: 'ar-4', title: '社区垃圾清运延迟投诉待派单', dept: '环卫保障中心', type: '市容管理', source: '小程序', area: '越秀区 · 东山街道', status: '待分拨', statusTone: 'pending', time: '08:57', elapsed: '入池 07分', level: 'low' },
        { id: 'ar-5', title: '电梯困人告警已完成坐席确认', dept: '应急联动中心', type: '应急处置', source: '视频AI', area: '番禺区 · 大石街道', status: '已受理', statusTone: 'active', time: '08:43', elapsed: '受理 03分', level: 'high' },
        { id: 'ar-6', title: '施工噪声重复来电待属地确认', dept: '属地街道办', type: '民生诉求', source: '12345热线', area: '黄埔区 · 联和街道', status: '待分拨', statusTone: 'pending', time: '08:30', elapsed: '入池 08分', level: 'medium' },
      ],
    },
    closureRate: {
      summaryLabel: '办结率关联案件',
      accent: '办结率 98.6%',
      items: [
        { id: 'cr-1', title: '老旧小区渗漏水投诉待最终反馈', dept: '住建局物业科', type: '住建服务', source: '热线回访', area: '越秀区 · 洪桥街道', status: '待反馈', statusTone: 'pending', time: '09:09', elapsed: '剩余 09分', level: 'medium' },
        { id: 'cr-2', title: '共享单车淤积处置进入闭环确认', dept: '城管执法队', type: '城市管理', source: '网格上报', area: '天河区 · 猎德街道', status: '待确认', statusTone: 'review', time: '08:54', elapsed: '剩余 06分', level: 'low' },
        { id: 'cr-3', title: '夜市油烟投诉处置待群众评价', dept: '生态环境分局', type: '生态环境', source: '12345热线', area: '荔湾区 · 多宝街道', status: '待反馈', statusTone: 'pending', time: '08:47', elapsed: '剩余 14分', level: 'high' },
        { id: 'cr-4', title: '人行道破损修复工单待复核', dept: '市政养护中心', type: '市政设施', source: '随手拍', area: '白云区 · 景泰街道', status: '待复核', statusTone: 'review', time: '08:25', elapsed: '剩余 12分', level: 'medium' },
        { id: 'cr-5', title: '消防通道清理事项等待销案', dept: '消防救援站', type: '消防安全', source: '视频巡查', area: '海珠区 · 赤岗街道', status: '待确认', statusTone: 'review', time: '08:13', elapsed: '剩余 05分', level: 'high' },
        { id: 'cr-6', title: '路灯恢复照明事项待回访', dept: '照明管理所', type: '公共服务', source: '12345热线', area: '南沙区 · 横沥镇', status: '待反馈', statusTone: 'pending', time: '08:04', elapsed: '剩余 16分', level: 'low' },
      ],
    },
    distribution: {
      summaryLabel: '工单类型分布关联案件',
      accent: '咨询类占比 32%',
      items: [
        { id: 'ds-1', title: '入学政策咨询工单持续增多', dept: '教育局便民专席', type: '咨询', source: '12345热线', area: '天河区 · 员村街道', status: '已受理', statusTone: 'active', time: '09:28', elapsed: '受理 03分', level: 'low' },
        { id: 'ds-2', title: '物业收费争议投诉待协调', dept: '住建局物业科', type: '投诉', source: '小程序', area: '番禺区 · 南村镇', status: '处理中', statusTone: 'active', time: '09:16', elapsed: '流转 09分', level: 'medium' },
        { id: 'ds-3', title: '独居老人上门协助求助已派单', dept: '民政服务中心', type: '求助', source: '社区上报', area: '越秀区 · 梅花村街道', status: '处理中', statusTone: 'active', time: '09:08', elapsed: '流转 06分', level: 'high' },
        { id: 'ds-4', title: '违法倾倒建筑垃圾举报待核查', dept: '城管执法队', type: '举报', source: '随手拍', area: '黄埔区 · 九龙街道', status: '待核查', statusTone: 'pending', time: '08:52', elapsed: '入池 11分', level: 'high' },
        { id: 'ds-5', title: '交通卡补办办理流程咨询', dept: '政务服务中心', type: '咨询', source: '热线回访', area: '海珠区 · 昌岗街道', status: '已受理', statusTone: 'active', time: '08:41', elapsed: '受理 02分', level: 'low' },
        { id: 'ds-6', title: '雨污分流施工噪声问题投诉', dept: '住建施工专班', type: '投诉', source: '12345热线', area: '白云区 · 棠景街道', status: '处理中', statusTone: 'active', time: '08:19', elapsed: '流转 12分', level: 'medium' },
      ],
    },
    hotrank: {
      summaryLabel: '热点区域关联案件',
      accent: '广州市热点量 4,286 件',
      items: [
        { id: 'hr-1', title: '珠江新城商圈夜间噪声持续升温', dept: '属地综合执法队', type: '民生诉求', source: '12345热线', area: '广州市 · 天河区', status: '处理中', statusTone: 'active', time: '09:21', elapsed: '流转 10分', level: 'high' },
        { id: 'hr-2', title: '大型交通枢纽客流疏导需求上升', dept: '交通运输局', type: '交通秩序', source: '视频AI', area: '深圳市 · 福田区', status: '待响应', statusTone: 'pending', time: '09:11', elapsed: '入池 06分', level: 'medium' },
        { id: 'hr-3', title: '暴雨后道路积水诉求密集上报', dept: '区防汛办', type: '应急处置', source: '网格上报', area: '佛山市 · 南海区', status: '处理中', statusTone: 'active', time: '09:04', elapsed: '流转 13分', level: 'high' },
        { id: 'hr-4', title: '工业园区宿舍消防隐患重复告警', dept: '消防救援支队', type: '消防安全', source: '物联感知', area: '东莞市 · 松山湖', status: '重点督办', statusTone: 'alert', time: '08:50', elapsed: '督办 18分', level: 'high' },
        { id: 'hr-5', title: '景区周边占道经营投诉反复出现', dept: '城管执法队', type: '城市管理', source: '随手拍', area: '珠海市 · 香洲区', status: '处理中', statusTone: 'active', time: '08:37', elapsed: '流转 15分', level: 'medium' },
        { id: 'hr-6', title: '老旧小区水压波动咨询持续抬升', dept: '水务集团客服', type: '公共服务', source: '热线回访', area: '中山市 · 石岐街道', status: '已受理', statusTone: 'active', time: '08:14', elapsed: '受理 04分', level: 'low' },
      ],
    },
    specialAnalysisItems: {
      summaryLabel: '事项分析关联案件',
      accent: '事项分析 Top10',
      items: [
        { id: 'sai-1', title: '校园周边占道经营诉求持续升温', dept: '属地综合执法队', type: '一级热点', source: '12345热线', area: '广州市 · 天河区', status: '处理中', statusTone: 'active', time: '09:26', elapsed: '流转 11分', level: 'high' },
        { id: 'sai-2', title: '夜间施工噪声扰民重复来电预警', dept: '住建施工专班', type: '一级热点', source: '视频AI', area: '深圳市 · 南山区', status: '待响应', statusTone: 'pending', time: '09:18', elapsed: '入池 05分', level: 'high' },
        { id: 'sai-3', title: '老旧小区停车矛盾工单量持续走高', dept: '区城运中心', type: '二级热点', source: '网格上报', area: '佛山市 · 南海区', status: '处理中', statusTone: 'active', time: '09:10', elapsed: '流转 08分', level: 'medium' },
        { id: 'sai-4', title: '沿街商铺油烟投诉进入重点监测', dept: '生态环境分局', type: '二级热点', source: '随手拍', area: '东莞市 · 松山湖', status: '待核查', statusTone: 'pending', time: '08:58', elapsed: '入池 06分', level: 'medium' },
        { id: 'sai-5', title: '住宅区充电安全隐患事项热度抬升', dept: '消防救援站', type: '三级热点', source: '物联感知', area: '珠海市 · 香洲区', status: '重点督办', statusTone: 'alert', time: '08:47', elapsed: '督办 12分', level: 'high' },
        { id: 'sai-6', title: '景区周边摊贩秩序问题进入高发期', dept: '城管执法队', type: '三级热点', source: '12345热线', area: '中山市 · 石岐街道', status: '处理中', statusTone: 'active', time: '08:35', elapsed: '流转 09分', level: 'medium' },
        { id: 'sai-7', title: '城中村环境卫生反复投诉进入榜单', dept: '街道办环卫专班', type: '一级热点', source: '网格上报', area: '广州市 · 白云区', status: '处理中', statusTone: 'active', time: '08:24', elapsed: '流转 07分', level: 'medium' },
        { id: 'sai-8', title: '商业街消防通道堵塞事项出现反弹', dept: '消防救援支队', type: '二级热点', source: '视频AI', area: '深圳市 · 福田区', status: '待响应', statusTone: 'pending', time: '08:13', elapsed: '入池 04分', level: 'high' },
        { id: 'sai-9', title: '学校周边交通秩序整治事项热度上升', dept: '交警支队', type: '三级热点', source: '随手拍', area: '佛山市 · 禅城区', status: '处理中', statusTone: 'active', time: '08:05', elapsed: '流转 10分', level: 'low' },
        { id: 'sai-10', title: '餐饮集中区油烟异味事项进入前十', dept: '生态环境分局', type: '三级热点', source: '12345热线', area: '东莞市 · 南城街道', status: '已受理', statusTone: 'active', time: '07:56', elapsed: '受理 03分', level: 'low' },
      ],
    },
    provinceAcceptance: {
      summaryLabel: '省预警受理指标关联案件',
      accent: '自动分拨率 / 1 小时签收率 / 高频诉求',
      items: [
        { id: 'pa-1', title: '广州商圈噪声扰民工单自动分拨成功', dept: '省城运中心', type: '民生服务', topic: '噪声治理', issue: '噪声扰民', source: '12345热线', area: '广州市 · 天河区', status: '已受理', statusTone: 'active', time: '09:22', elapsed: '受理 03分', level: 'medium' },
        { id: 'pa-2', title: '深圳道路设施缺损告警 1 小时内签收', dept: '省住建联动专班', type: '城市管理', topic: '道路设施', issue: '路灯故障', source: '视频AI', area: '深圳市 · 福田区', status: '已签收', statusTone: 'active', time: '09:14', elapsed: '签收 18分', level: 'medium' },
        { id: 'pa-3', title: '佛山重复来电噪声诉求进入快速受理通道', dept: '省城运中心', type: '民生服务', topic: '噪声治理', issue: '噪声扰民', source: '12345热线', area: '佛山市 · 南海区', status: '待派单', statusTone: 'pending', time: '09:08', elapsed: '入池 07分', level: 'high' },
        { id: 'pa-4', title: '东莞占道经营问题自动流转至承办专班', dept: '省交通秩序专班', type: '城市管理', topic: '市容秩序', issue: '占道经营', source: '网格上报', area: '东莞市 · 松山湖', status: '已受理', statusTone: 'active', time: '08:56', elapsed: '流转 05分', level: 'low' },
        { id: 'pa-5', title: '珠海道路积水告警进入首响响应', dept: '省应急处置中心', type: '公共安全', topic: '积水整治', issue: '道路积水', source: '物联感知', area: '珠海市 · 香洲区', status: '已受理', statusTone: 'active', time: '08:48', elapsed: '受理 04分', level: 'high' },
        { id: 'pa-6', title: '中山餐饮油烟投诉高频聚集待核查', dept: '省生态环境专班', type: '生态环境', topic: '油烟扰民', issue: '油烟异味', source: '随手拍', area: '中山市 · 石岐街道', status: '待分拨', statusTone: 'pending', time: '08:36', elapsed: '入池 06分', level: 'medium' },
      ],
    },
    provinceClosure: {
      summaryLabel: '省预警承办指标关联案件',
      accent: '办理中 / 已办结 / 超时件 / 监察指标',
      items: [
        { id: 'pc-1', title: '广州重点噪声治理事项待最终回访', dept: '省城运中心', type: '民生服务', topic: '噪声治理', issue: '噪声扰民', source: '12345热线', area: '广州市 · 天河区', status: '待反馈', statusTone: 'pending', time: '09:18', elapsed: '剩余 09分', level: 'high' },
        { id: 'pc-2', title: '深圳消防通道隐患处置进入复核阶段', dept: '省应急处置中心', type: '公共安全', topic: '消防隐患', issue: '消防通道占用', source: '视频巡查', area: '深圳市 · 龙岗区', status: '待复核', statusTone: 'review', time: '09:10', elapsed: '剩余 11分', level: 'high' },
        { id: 'pc-3', title: '佛山道路积水工单处置结果待确认', dept: '省应急处置中心', type: '公共安全', topic: '积水整治', issue: '道路积水', source: '网格上报', area: '佛山市 · 南海区', status: '处理中', statusTone: 'active', time: '09:01', elapsed: '流转 13分', level: 'medium' },
        { id: 'pc-4', title: '东莞枢纽片区违停问题进入督办闭环', dept: '省交通秩序专班', type: '交通秩序', topic: '市容秩序', issue: '占道经营', source: '视频AI', area: '东莞市 · 松山湖', status: '重点督办', statusTone: 'alert', time: '08:47', elapsed: '督办 17分', level: 'high' },
        { id: 'pc-5', title: '珠海路灯故障事项完成办结待销案', dept: '省住建联动专班', type: '城市管理', topic: '道路设施', issue: '路灯故障', source: '12345热线', area: '珠海市 · 香洲区', status: '待确认', statusTone: 'review', time: '08:39', elapsed: '剩余 08分', level: 'low' },
        { id: 'pc-6', title: '中山餐饮油烟投诉超时件进入二次分派', dept: '省生态环境专班', type: '生态环境', topic: '油烟扰民', issue: '油烟异味', source: '随手拍', area: '中山市 · 石岐街道', status: '超时预警', statusTone: 'alert', time: '08:24', elapsed: '超时 12分', level: 'medium' },
      ],
    },
    provinceDistribution: {
      summaryLabel: '省预警工单类型关联案件',
      accent: '城市管理占比最高',
      items: [
        { id: 'pd-1', title: '广州市容秩序问题进入联合处置', dept: '省城运中心', type: '城市管理', topic: '市容秩序', issue: '占道经营', source: '网格上报', area: '广州市 · 白云区', status: '处理中', statusTone: 'active', time: '09:20', elapsed: '流转 08分', level: 'medium' },
        { id: 'pd-2', title: '深圳噪声扰民诉求触发夜间专班联动', dept: '省城运中心', type: '民生服务', topic: '噪声治理', issue: '噪声扰民', source: '12345热线', area: '深圳市 · 福田区', status: '已受理', statusTone: 'active', time: '09:12', elapsed: '受理 04分', level: 'high' },
        { id: 'pd-3', title: '佛山消防隐患告警已下发属地整改', dept: '省应急处置中心', type: '公共安全', topic: '消防隐患', issue: '消防通道占用', source: '视频巡查', area: '佛山市 · 禅城区', status: '待响应', statusTone: 'pending', time: '09:03', elapsed: '入池 05分', level: 'high' },
        { id: 'pd-4', title: '东莞枢纽片区交通秩序整治持续跟踪', dept: '省交通秩序专班', type: '交通秩序', topic: '市容秩序', issue: '占道经营', source: '视频AI', area: '东莞市 · 松山湖', status: '处理中', statusTone: 'active', time: '08:50', elapsed: '流转 09分', level: 'medium' },
        { id: 'pd-5', title: '珠海油烟异味问题转生态专班核查', dept: '省生态环境专班', type: '生态环境', topic: '油烟扰民', issue: '油烟异味', source: '随手拍', area: '珠海市 · 香洲区', status: '待核查', statusTone: 'pending', time: '08:41', elapsed: '入池 06分', level: 'medium' },
        { id: 'pd-6', title: '中山道路设施修复工单完成派单', dept: '省住建联动专班', type: '城市管理', topic: '道路设施', issue: '路灯故障', source: '12345热线', area: '中山市 · 东区街道', status: '已派单', statusTone: 'active', time: '08:28', elapsed: '派单 03分', level: 'low' },
      ],
    },
    provinceGovernance: {
      summaryLabel: '重点治理热点关联案件',
      accent: '噪声治理 / 积水整治 / 消防隐患',
      items: [
        { id: 'pg-1', title: '广州夜间商圈噪声治理事项升级督办', dept: '省城运中心', type: '民生服务', topic: '噪声治理', issue: '噪声扰民', source: '12345热线', area: '广州市 · 天河区', status: '重点督办', statusTone: 'alert', time: '09:24', elapsed: '督办 12分', level: 'high' },
        { id: 'pg-2', title: '深圳道路积水隐患列入强降雨清单', dept: '省应急处置中心', type: '公共安全', topic: '积水整治', issue: '道路积水', source: '物联感知', area: '深圳市 · 龙华区', status: '处理中', statusTone: 'active', time: '09:15', elapsed: '流转 10分', level: 'high' },
        { id: 'pg-3', title: '佛山消防隐患点位完成属地复检', dept: '省应急处置中心', type: '公共安全', topic: '消防隐患', issue: '消防通道占用', source: '视频巡查', area: '佛山市 · 南海区', status: '待反馈', statusTone: 'pending', time: '09:05', elapsed: '剩余 09分', level: 'medium' },
        { id: 'pg-4', title: '东莞市容秩序整治问题进入高频回访', dept: '省交通秩序专班', type: '城市管理', topic: '市容秩序', issue: '占道经营', source: '网格上报', area: '东莞市 · 松山湖', status: '处理中', statusTone: 'active', time: '08:49', elapsed: '流转 11分', level: 'medium' },
        { id: 'pg-5', title: '珠海道路设施故障重复诉求待闭环', dept: '省住建联动专班', type: '城市管理', topic: '道路设施', issue: '路灯故障', source: '12345热线', area: '珠海市 · 香洲区', status: '待确认', statusTone: 'review', time: '08:38', elapsed: '剩余 07分', level: 'low' },
        { id: 'pg-6', title: '中山油烟扰民重点治理点进入夜查', dept: '省生态环境专班', type: '生态环境', topic: '油烟扰民', issue: '油烟异味', source: '随手拍', area: '中山市 · 石岐街道', status: '处理中', statusTone: 'active', time: '08:26', elapsed: '流转 08分', level: 'medium' },
      ],
    },
    provinceProblem: {
      summaryLabel: '热点问题排名关联案件',
      accent: '噪声扰民位列首位',
      items: [
        { id: 'pp-1', title: '广州夜间经营噪声问题持续升温', dept: '省城运中心', type: '民生服务', topic: '噪声治理', issue: '噪声扰民', source: '12345热线', area: '广州市 · 天河区', status: '处理中', statusTone: 'active', time: '09:19', elapsed: '流转 09分', level: 'high' },
        { id: 'pp-2', title: '佛山暴雨后道路积水诉求反复出现', dept: '省应急处置中心', type: '公共安全', topic: '积水整治', issue: '道路积水', source: '网格上报', area: '佛山市 · 南海区', status: '已受理', statusTone: 'active', time: '09:07', elapsed: '受理 04分', level: 'high' },
        { id: 'pp-3', title: '深圳小区消防通道占用进入联合巡查', dept: '省应急处置中心', type: '公共安全', topic: '消防隐患', issue: '消防通道占用', source: '视频巡查', area: '深圳市 · 龙岗区', status: '待核查', statusTone: 'pending', time: '08:55', elapsed: '入池 05分', level: 'high' },
        { id: 'pp-4', title: '中山餐饮街区油烟异味投诉集中', dept: '省生态环境专班', type: '生态环境', topic: '油烟扰民', issue: '油烟异味', source: '随手拍', area: '中山市 · 石岐街道', status: '处理中', statusTone: 'active', time: '08:44', elapsed: '流转 08分', level: 'medium' },
        { id: 'pp-5', title: '东莞主干道占道经营影响通行秩序', dept: '省交通秩序专班', type: '城市管理', topic: '市容秩序', issue: '占道经营', source: '网格上报', area: '东莞市 · 松山湖', status: '待响应', statusTone: 'pending', time: '08:33', elapsed: '入池 07分', level: 'medium' },
        { id: 'pp-6', title: '珠海老旧片区路灯故障待批量修复', dept: '省住建联动专班', type: '城市管理', topic: '道路设施', issue: '路灯故障', source: '12345热线', area: '珠海市 · 香洲区', status: '待派单', statusTone: 'pending', time: '08:18', elapsed: '入池 06分', level: 'low' },
      ],
    },
    provinceHotrank: {
      summaryLabel: '省预警区域热点关联案件',
      accent: '广州 / 深圳 / 佛山 热点量较高',
      items: [
        { id: 'phr-1', title: '广州商业综合体噪声诉求持续聚集', dept: '省城运中心', type: '民生服务', topic: '噪声治理', issue: '噪声扰民', source: '12345热线', area: '广州市 · 天河区', status: '处理中', statusTone: 'active', time: '09:23', elapsed: '流转 11分', level: 'high' },
        { id: 'phr-2', title: '深圳核心片区消防隐患告警重复抬升', dept: '省应急处置中心', type: '公共安全', topic: '消防隐患', issue: '消防通道占用', source: '视频巡查', area: '深圳市 · 福田区', status: '重点督办', statusTone: 'alert', time: '09:12', elapsed: '督办 14分', level: 'high' },
        { id: 'phr-3', title: '佛山雨后积水问题进入属地抢排', dept: '省应急处置中心', type: '公共安全', topic: '积水整治', issue: '道路积水', source: '物联感知', area: '佛山市 · 南海区', status: '处理中', statusTone: 'active', time: '09:00', elapsed: '流转 12分', level: 'high' },
        { id: 'phr-4', title: '东莞园区占道经营诉求持续上升', dept: '省交通秩序专班', type: '城市管理', topic: '市容秩序', issue: '占道经营', source: '网格上报', area: '东莞市 · 松山湖', status: '处理中', statusTone: 'active', time: '08:46', elapsed: '流转 10分', level: 'medium' },
        { id: 'phr-5', title: '珠海沿海商圈油烟扰民投诉升温', dept: '省生态环境专班', type: '生态环境', topic: '油烟扰民', issue: '油烟异味', source: '随手拍', area: '珠海市 · 香洲区', status: '待核查', statusTone: 'pending', time: '08:34', elapsed: '入池 05分', level: 'medium' },
        { id: 'phr-6', title: '中山城区道路设施问题进入批量处置', dept: '省住建联动专班', type: '城市管理', topic: '道路设施', issue: '路灯故障', source: '12345热线', area: '中山市 · 石岐街道', status: '已派单', statusTone: 'active', time: '08:20', elapsed: '派单 04分', level: 'low' },
      ],
    },
    provinceTrend: {
      summaryLabel: '全省热点趋势关联案件',
      accent: '年度趋势持续抬升',
      items: [
        { id: 'pt-1', title: '一季度噪声治理案件进入持续跟踪', dept: '省城运中心', type: '民生服务', topic: '噪声治理', issue: '噪声扰民', source: '12345热线', area: '广州市 · 天河区', status: '处理中', statusTone: 'active', time: '09:16', elapsed: '流转 10分', level: 'medium' },
        { id: 'pt-2', title: '二季度积水整治事项纳入强降雨专班', dept: '省应急处置中心', type: '公共安全', topic: '积水整治', issue: '道路积水', source: '物联感知', area: '佛山市 · 南海区', status: '重点督办', statusTone: 'alert', time: '09:06', elapsed: '督办 13分', level: 'high' },
        { id: 'pt-3', title: '三季度消防隐患问题持续位于高位', dept: '省应急处置中心', type: '公共安全', topic: '消防隐患', issue: '消防通道占用', source: '视频巡查', area: '深圳市 · 龙岗区', status: '待反馈', statusTone: 'pending', time: '08:52', elapsed: '剩余 07分', level: 'high' },
        { id: 'pt-4', title: '四季度油烟扰民问题在商圈夜间增多', dept: '省生态环境专班', type: '生态环境', topic: '油烟扰民', issue: '油烟异味', source: '随手拍', area: '中山市 · 石岐街道', status: '处理中', statusTone: 'active', time: '08:37', elapsed: '流转 09分', level: 'medium' },
        { id: 'pt-5', title: '道路设施类问题在年末集中回流', dept: '省住建联动专班', type: '城市管理', topic: '道路设施', issue: '路灯故障', source: '12345热线', area: '珠海市 · 香洲区', status: '待确认', statusTone: 'review', time: '08:25', elapsed: '剩余 06分', level: 'low' },
        { id: 'pt-6', title: '占道经营问题在节假日客流下明显上升', dept: '省交通秩序专班', type: '交通秩序', topic: '市容秩序', issue: '占道经营', source: '网格上报', area: '东莞市 · 松山湖', status: '待响应', statusTone: 'pending', time: '08:14', elapsed: '入池 05分', level: 'medium' },
      ],
    },
  },
  departments: [
    { name: '城管局', status: '正常', detail: '12 项联动事项在办' },
    { name: '公安分局', status: '协同中', detail: '4 起重点事件联处' },
    { name: '住建局', status: '待反馈', detail: '2 起设施类工单待回传' },
    { name: '水务局', status: '联动中', detail: '3 处积水点位持续关注' },
  ],
  viewport: {
    summary: {
      eyebrow: '当前在办',
      value: 318,
      unit: '件',
      title: '跨层级联动处置中',
      compare: ['超时预警 23 件', '重点督办 7 件'],
    },
    metrics: [
      { label: '在线视频巡查', value: '4,286 路' },
      { label: '感知告警接入', value: '1,942 条' },
      { label: '今日联动部门', value: '12 个' },
      { label: '平均派单时长', value: '7.8 分钟' },
    ],
    legend: [
      { label: '红色预警', value: '2 件', level: 'high' },
      { label: '橙黄预警', value: '17 件', level: 'medium' },
      { label: '蓝色提示', value: '34 件', level: 'low' },
    ],
  },
  bulletin: [
    { time: '09:24', dept: '12345热线', text: '天河区噪声扰民诉求连续 3 小时位列首位' },
    { time: '09:18', dept: '区防汛办', text: '海珠区新港街道积水点已启动红色联动处置' },
    { time: '09:06', dept: '城管局', text: '白云区井盖破损工单已转市政养护中心现场抢修' },
  ],
  mapContext: {
    selected: {
      title: '越秀区',
      main: '今日事件 1,268 件',
      meta: [
        { label: '办结率', value: '98.4%' },
        { label: '风险等级', value: '中' },
        { label: '热点问题', value: '噪声扰民' },
      ],
    },
    patrol: {
      title: '在线网格员 324 人',
      main: '今日巡查 1,826 次',
      meta: [
        { label: '异常上报', value: '37 件' },
        { label: '较昨日', value: '+8.2%' },
        { label: '闭环率', value: '96.7%' },
      ],
    },
    linkage: {
      title: '已联动部门 8 个',
      main: '红橙黄蓝预警 2 / 5 / 12 / 34',
      meta: [
        { label: '最高等级', value: '红色预警' },
        { label: '最近联动', value: '09:18' },
        { label: '反馈率', value: '91.2%' },
      ],
    },
  },
  cityMetrics: {
    广州市: [
      { label: '接通率', value: 98.2, unit: '%', format: 'decimal1', note: '热线运行稳定' },
      { label: '解决率', value: 96.8, unit: '%', format: 'decimal1', note: '闭环效率领先' },
      { label: '满意率', value: 97.6, unit: '%', format: 'decimal1', note: '回访反馈良好' },
      { label: '事件总量', value: 4286, unit: '件', format: 'integer', note: '全省热点最高' },
      { label: '未办结量', value: 112, unit: '件', format: 'integer', note: '重点在办跟踪' },
      { label: '超时量', value: 18, unit: '件', format: 'integer', note: '红色督办 2 件' },
    ],
    深圳市: [
      { label: '接通率', value: 97.8, unit: '%', format: 'decimal1', note: '峰值响应平稳' },
      { label: '解决率', value: 95.9, unit: '%', format: 'decimal1', note: '跨部门联动快' },
      { label: '满意率', value: 96.7, unit: '%', format: 'decimal1', note: '回访评价稳定' },
      { label: '事件总量', value: 3942, unit: '件', format: 'integer', note: '枢纽诉求集中' },
      { label: '未办结量', value: 128, unit: '件', format: 'integer', note: '交通类在办偏高' },
      { label: '超时量', value: 22, unit: '件', format: 'integer', note: '重点跟踪福田片区' },
    ],
    佛山市: [
      { label: '接通率', value: 97.1, unit: '%', format: 'decimal1', note: '热线接入顺畅' },
      { label: '解决率', value: 95.4, unit: '%', format: 'decimal1', note: '制造园区联办' },
      { label: '满意率', value: 96.2, unit: '%', format: 'decimal1', note: '民生事项改善' },
      { label: '事件总量', value: 2618, unit: '件', format: 'integer', note: '雨后积水多发' },
      { label: '未办结量', value: 86, unit: '件', format: 'integer', note: '防汛事项较多' },
      { label: '超时量', value: 15, unit: '件', format: 'integer', note: '待区级复核' },
    ],
    东莞市: [
      { label: '接通率', value: 96.8, unit: '%', format: 'decimal1', note: '企业诉求响应快' },
      { label: '解决率', value: 94.7, unit: '%', format: 'decimal1', note: '工业园处置中' },
      { label: '满意率', value: 95.8, unit: '%', format: 'decimal1', note: '闭环反馈稳定' },
      { label: '事件总量', value: 2344, unit: '件', format: 'integer', note: '园区热度上行' },
      { label: '未办结量', value: 94, unit: '件', format: 'integer', note: '消防工单偏多' },
      { label: '超时量', value: 19, unit: '件', format: 'integer', note: '夜间工单滞后' },
    ],
    珠海市: [
      { label: '接通率', value: 97.5, unit: '%', format: 'decimal1', note: '旅游区通话平稳' },
      { label: '解决率', value: 95.1, unit: '%', format: 'decimal1', note: '景区联动处置' },
      { label: '满意率', value: 96.5, unit: '%', format: 'decimal1', note: '游客评价较好' },
      { label: '事件总量', value: 1826, unit: '件', format: 'integer', note: '节假日客流影响' },
      { label: '未办结量', value: 68, unit: '件', format: 'integer', note: '景区秩序在办' },
      { label: '超时量', value: 11, unit: '件', format: 'integer', note: '待属地签收' },
    ],
    中山市: [
      { label: '接通率', value: 96.9, unit: '%', format: 'decimal1', note: '市镇两级协同' },
      { label: '解决率', value: 94.9, unit: '%', format: 'decimal1', note: '老旧小区事项多' },
      { label: '满意率', value: 95.7, unit: '%', format: 'decimal1', note: '回访通过率稳定' },
      { label: '事件总量', value: 1652, unit: '件', format: 'integer', note: '公共服务诉求集中' },
      { label: '未办结量', value: 61, unit: '件', format: 'integer', note: '供水类待复核' },
      { label: '超时量', value: 9, unit: '件', format: 'integer', note: '历史积压下降' },
    ],
    惠州市: [
      { label: '接通率', value: 96.4, unit: '%', format: 'decimal1', note: '山海片区平稳' },
      { label: '解决率', value: 94.3, unit: '%', format: 'decimal1', note: '跨镇街流转中' },
      { label: '满意率', value: 95.4, unit: '%', format: 'decimal1', note: '重点事项回访中' },
      { label: '事件总量', value: 1498, unit: '件', format: 'integer', note: '网格巡查提升' },
      { label: '未办结量', value: 73, unit: '件', format: 'integer', note: '市政修复排队' },
      { label: '超时量', value: 13, unit: '件', format: 'integer', note: '山区点位响应慢' },
    ],
    江门市: [
      { label: '接通率', value: 95.8, unit: '%', format: 'decimal1', note: '乡镇接入稳定' },
      { label: '解决率', value: 93.8, unit: '%', format: 'decimal1', note: '涉水工单较多' },
      { label: '满意率', value: 94.9, unit: '%', format: 'decimal1', note: '群众评价回升' },
      { label: '事件总量', value: 1324, unit: '件', format: 'integer', note: '民生诉求为主' },
      { label: '未办结量', value: 58, unit: '件', format: 'integer', note: '正在清单化推进' },
      { label: '超时量', value: 12, unit: '件', format: 'integer', note: '防汛类待回传' },
    ],
    肇庆市: [
      { label: '接通率', value: 95.5, unit: '%', format: 'decimal1', note: '山区线路稳定' },
      { label: '解决率', value: 93.4, unit: '%', format: 'decimal1', note: '县区协办中' },
      { label: '满意率', value: 94.6, unit: '%', format: 'decimal1', note: '回访保持平稳' },
      { label: '事件总量', value: 1186, unit: '件', format: 'integer', note: '县域诉求分散' },
      { label: '未办结量', value: 52, unit: '件', format: 'integer', note: '处置节奏正常' },
      { label: '超时量', value: 10, unit: '件', format: 'integer', note: '少量历史尾单' },
    ],
    清远市: [
      { label: '接通率', value: 95.1, unit: '%', format: 'decimal1', note: '山区热线平稳' },
      { label: '解决率', value: 92.9, unit: '%', format: 'decimal1', note: '农村事项占比高' },
      { label: '满意率', value: 94.2, unit: '%', format: 'decimal1', note: '回访评价改善' },
      { label: '事件总量', value: 1098, unit: '件', format: 'integer', note: '防灾诉求增加' },
      { label: '未办结量', value: 55, unit: '件', format: 'integer', note: '乡镇联办中' },
      { label: '超时量', value: 14, unit: '件', format: 'integer', note: '交通路段响应慢' },
    ],
    汕头市: [
      { label: '接通率', value: 95.7, unit: '%', format: 'decimal1', note: '滨海片区稳定' },
      { label: '解决率', value: 93.6, unit: '%', format: 'decimal1', note: '旅游诉求升高' },
      { label: '满意率', value: 94.8, unit: '%', format: 'decimal1', note: '市民反馈良好' },
      { label: '事件总量', value: 1214, unit: '件', format: 'integer', note: '假日秩序事项多' },
      { label: '未办结量', value: 57, unit: '件', format: 'integer', note: '海边景区在办' },
      { label: '超时量', value: 11, unit: '件', format: 'integer', note: '夜间回传偏慢' },
    ],
    湛江市: [
      { label: '接通率', value: 94.9, unit: '%', format: 'decimal1', note: '沿海热线稳定' },
      { label: '解决率', value: 92.8, unit: '%', format: 'decimal1', note: '渔港事项集中' },
      { label: '满意率', value: 94.1, unit: '%', format: 'decimal1', note: '回访仍在提升' },
      { label: '事件总量', value: 1162, unit: '件', format: 'integer', note: '港区诉求偏多' },
      { label: '未办结量', value: 63, unit: '件', format: 'integer', note: '跨部门流转中' },
      { label: '超时量', value: 16, unit: '件', format: 'integer', note: '天气影响处置' },
    ],
    茂名市: [
      { label: '接通率', value: 94.7, unit: '%', format: 'decimal1', note: '县域接入稳定' },
      { label: '解决率', value: 92.4, unit: '%', format: 'decimal1', note: '涉农事项较多' },
      { label: '满意率', value: 93.9, unit: '%', format: 'decimal1', note: '回访提升中' },
      { label: '事件总量', value: 1046, unit: '件', format: 'integer', note: '涉农与环保并行' },
      { label: '未办结量', value: 59, unit: '件', format: 'integer', note: '乡镇待签收' },
      { label: '超时量', value: 15, unit: '件', format: 'integer', note: '个别远端点位超时' },
    ],
    韶关市: [
      { label: '接通率', value: 94.8, unit: '%', format: 'decimal1', note: '山区呼入平稳' },
      { label: '解决率', value: 92.7, unit: '%', format: 'decimal1', note: '生态类事项较多' },
      { label: '满意率', value: 94.0, unit: '%', format: 'decimal1', note: '群众评价中性偏好' },
      { label: '事件总量', value: 982, unit: '件', format: 'integer', note: '林区巡查上报多' },
      { label: '未办结量', value: 54, unit: '件', format: 'integer', note: '跨县协查中' },
      { label: '超时量', value: 13, unit: '件', format: 'integer', note: '应急事项待销案' },
    ],
    梅州市: [
      { label: '接通率', value: 94.6, unit: '%', format: 'decimal1', note: '山区网络平稳' },
      { label: '解决率', value: 92.1, unit: '%', format: 'decimal1', note: '农村民生诉求多' },
      { label: '满意率', value: 93.8, unit: '%', format: 'decimal1', note: '回访完成率提升' },
      { label: '事件总量', value: 928, unit: '件', format: 'integer', note: '乡镇分布较散' },
      { label: '未办结量', value: 49, unit: '件', format: 'integer', note: '设施维修排队中' },
      { label: '超时量', value: 12, unit: '件', format: 'integer', note: '边远乡镇响应慢' },
    ],
    河源市: [
      { label: '接通率', value: 94.5, unit: '%', format: 'decimal1', note: '水源地片区平稳' },
      { label: '解决率', value: 92.0, unit: '%', format: 'decimal1', note: '环保问题较多' },
      { label: '满意率', value: 93.6, unit: '%', format: 'decimal1', note: '群众评价逐步回升' },
      { label: '事件总量', value: 904, unit: '件', format: 'integer', note: '农村诉求占比高' },
      { label: '未办结量', value: 47, unit: '件', format: 'integer', note: '林区巡查事项在办' },
      { label: '超时量', value: 11, unit: '件', format: 'integer', note: '待上报回传' },
    ],
    阳江市: [
      { label: '接通率', value: 94.9, unit: '%', format: 'decimal1', note: '海岸带通话稳定' },
      { label: '解决率', value: 92.6, unit: '%', format: 'decimal1', note: '旅游秩序协办中' },
      { label: '满意率', value: 93.9, unit: '%', format: 'decimal1', note: '投诉回落明显' },
      { label: '事件总量', value: 968, unit: '件', format: 'integer', note: '海边景区事项增加' },
      { label: '未办结量', value: 46, unit: '件', format: 'integer', note: '夜间工单待处置' },
      { label: '超时量', value: 12, unit: '件', format: 'integer', note: '台风期重点关注' },
    ],
    云浮市: [
      { label: '接通率', value: 94.2, unit: '%', format: 'decimal1', note: '县域呼入稳定' },
      { label: '解决率', value: 91.8, unit: '%', format: 'decimal1', note: '山区道路事项偏多' },
      { label: '满意率', value: 93.4, unit: '%', format: 'decimal1', note: '回访表现中等' },
      { label: '事件总量', value: 846, unit: '件', format: 'integer', note: '道路设施诉求多' },
      { label: '未办结量', value: 44, unit: '件', format: 'integer', note: '镇街协办中' },
      { label: '超时量', value: 10, unit: '件', format: 'integer', note: '少量尾单跟进' },
    ],
    汕尾市: [
      { label: '接通率', value: 94.8, unit: '%', format: 'decimal1', note: '滨海区运行平稳' },
      { label: '解决率', value: 92.5, unit: '%', format: 'decimal1', note: '海域环境诉求较多' },
      { label: '满意率', value: 93.7, unit: '%', format: 'decimal1', note: '群众评价向好' },
      { label: '事件总量', value: 886, unit: '件', format: 'integer', note: '休渔期诉求波动' },
      { label: '未办结量', value: 45, unit: '件', format: 'integer', note: '港区巡查在办' },
      { label: '超时量', value: 11, unit: '件', format: 'integer', note: '夜间回传偏慢' },
    ],
    揭阳市: [
      { label: '接通率', value: 94.4, unit: '%', format: 'decimal1', note: '县镇热线稳定' },
      { label: '解决率', value: 92.2, unit: '%', format: 'decimal1', note: '城乡协同推进' },
      { label: '满意率', value: 93.5, unit: '%', format: 'decimal1', note: '评价中等偏上' },
      { label: '事件总量', value: 902, unit: '件', format: 'integer', note: '民生诉求上升' },
      { label: '未办结量', value: 48, unit: '件', format: 'integer', note: '道路整治在办' },
      { label: '超时量', value: 12, unit: '件', format: 'integer', note: '部分案件待复核' },
    ],
    潮州市: [
      { label: '接通率', value: 94.3, unit: '%', format: 'decimal1', note: '古城片区稳定' },
      { label: '解决率', value: 91.9, unit: '%', format: 'decimal1', note: '文旅诉求较多' },
      { label: '满意率', value: 93.2, unit: '%', format: 'decimal1', note: '游客反馈回升' },
      { label: '事件总量', value: 834, unit: '件', format: 'integer', note: '节庆活动影响' },
      { label: '未办结量', value: 43, unit: '件', format: 'integer', note: '古城秩序在办' },
      { label: '超时量', value: 10, unit: '件', format: 'integer', note: '夜间执法回传慢' },
    ],
  },
  appealHotItem: {
    level1: [
      { label: '城市管理', value: 4286, ratio: 25.8 },
      { label: '市场监管', value: 3942, ratio: 18.3 },
      { label: '住房建设', value: 2618, ratio: 12.5 },
      { label: '生态环境', value: 2344, ratio: 8.6 },
      { label: '交通运输', value: 1826, ratio: 5.2 },
      { label: '社会治安', value: 1650, ratio: 2.1 },
      { label: '教育管理', value: 1480, ratio: -1.8 },
      { label: '医疗卫生', value: 1320, ratio: -4.5 },
      { label: '劳动保障', value: 1156, ratio: -7.2 },
      { label: '农业农村', value: 980, ratio: -10.6 },
    ],
    level2: [
      { label: '市容环卫', value: 3120, ratio: 22.4 },
      { label: '违法建设', value: 2870, ratio: 16.8 },
      { label: '消费维权', value: 2456, ratio: 11.2 },
      { label: '噪声污染', value: 2130, ratio: 7.5 },
      { label: '占道经营', value: 1890, ratio: 4.1 },
      { label: '物业管理', value: 1720, ratio: 1.6 },
      { label: '燃气安全', value: 1560, ratio: -2.3 },
      { label: '食品安全', value: 1410, ratio: -5.8 },
      { label: '水污染', value: 1250, ratio: -8.4 },
      { label: '道路交通', value: 1080, ratio: -11.2 },
    ],
    level3: [
      { label: '路面保洁', value: 2180, ratio: 19.6 },
      { label: '餐饮油烟', value: 1940, ratio: 14.2 },
      { label: '夜间施工', value: 1720, ratio: 9.8 },
      { label: '无证摊贩', value: 1560, ratio: 5.4 },
      { label: '垃圾分类', value: 1340, ratio: 2.1 },
      { label: '违章停车', value: 1200, ratio: -0.8 },
      { label: '施工扬尘', value: 1060, ratio: -4.2 },
      { label: '电梯故障', value: 920, ratio: -7.6 },
      { label: '井盖缺失', value: 780, ratio: -10.1 },
      { label: '路灯损坏', value: 650, ratio: -13.5 },
    ],
  },
  appealRegion: {
    city: [
      { label: '广州', value: 4286, color: '#57b8ff' },
      { label: '深圳', value: 3942, color: '#4de0d4' },
      { label: '佛山', value: 2618, color: '#8b9bff' },
      { label: '东莞', value: 2344, color: '#ffb561' },
      { label: '珠海', value: 1826, color: '#57b8ff' },
      { label: '中山', value: 1560, color: '#4de0d4' },
      { label: '惠州', value: 1340, color: '#8b9bff' },
      { label: '江门', value: 1120, color: '#ffb561' },
      { label: '肇庆', value: 960, color: '#57b8ff' },
      { label: '汕头', value: 780, color: '#4de0d4' },
    ],
    street: [
      { label: '石牌街道', value: 1260, color: '#57b8ff' },
      { label: '北京街道', value: 1080, color: '#4de0d4' },
      { label: '新港街道', value: 960, color: '#8b9bff' },
      { label: '同和街道', value: 840, color: '#ffb561' },
      { label: '嘉禾街道', value: 720, color: '#57b8ff' },
      { label: '天河南街道', value: 640, color: '#4de0d4' },
      { label: '林和街道', value: 560, color: '#8b9bff' },
      { label: '沙河街道', value: 480, color: '#ffb561' },
      { label: '兴华街道', value: 400, color: '#57b8ff' },
      { label: '元岗街道', value: 340, color: '#4de0d4' },
    ],
    community: [
      { label: '南村社区', value: 460, color: '#57b8ff' },
      { label: '石牌社区', value: 380, color: '#4de0d4' },
      { label: '珠江社区', value: 320, color: '#8b9bff' },
      { label: '新港社区', value: 280, color: '#ffb561' },
      { label: '棠下社区', value: 240, color: '#57b8ff' },
      { label: '华景社区', value: 200, color: '#4de0d4' },
      { label: '龙口社区', value: 170, color: '#8b9bff' },
      { label: '猎德社区', value: 140, color: '#ffb561' },
      { label: '洗村社区', value: 110, color: '#57b8ff' },
      { label: '车陂社区', value: 86, color: '#4de0d4' },
    ],
  },
  appealNewItem: {
    level1: [
      { label: '城市管理', value: 3860, ratio: 23.5 },
      { label: '市场监管', value: 3520, ratio: 18.2 },
      { label: '住房建设', value: 2340, ratio: 12.6 },
      { label: '生态环境', value: 2080, ratio: 8.4 },
      { label: '交通运输', value: 1640, ratio: 5.1 },
    ],
    level2: [
      { label: '市容环卫', value: 2840, ratio: 21.8 },
      { label: '违法建设', value: 2590, ratio: 16.5 },
      { label: '消费维权', value: 2200, ratio: 11.2 },
      { label: '噪声污染', value: 1920, ratio: 7.6 },
      { label: '占道经营', value: 1700, ratio: 4.3 },
    ],
    level3: [
      { label: '路面保洁', value: 1960, ratio: 19.4 },
      { label: '餐饮油烟', value: 1740, ratio: 14.8 },
      { label: '夜间施工', value: 1540, ratio: 9.6 },
      { label: '无证摊贩', value: 1380, ratio: 6.2 },
      { label: '垃圾分类', value: 1200, ratio: 3.4 },
    ],
  },
  appealNewRegion: {
    city: [
      { label: '广州', value: 3860, color: '#57b8ff' },
      { label: '深圳', value: 3520, color: '#4de0d4' },
      { label: '佛山', value: 2340, color: '#8b9bff' },
      { label: '东莞', value: 2080, color: '#ffb561' },
      { label: '珠海', value: 1640, color: '#57b8ff' },
      { label: '中山', value: 1380, color: '#4de0d4' },
      { label: '惠州', value: 1180, color: '#8b9bff' },
      { label: '江门', value: 980, color: '#ffb561' },
      { label: '肇庆', value: 840, color: '#57b8ff' },
      { label: '汕头', value: 680, color: '#4de0d4' },
    ],
    street: [
      { label: '石牌街道', value: 1120, color: '#57b8ff' },
      { label: '北京街道', value: 960, color: '#4de0d4' },
      { label: '新港街道', value: 840, color: '#8b9bff' },
      { label: '同和街道', value: 720, color: '#ffb561' },
      { label: '嘉禾街道', value: 620, color: '#57b8ff' },
      { label: '天河南街道', value: 540, color: '#4de0d4' },
      { label: '林和街道', value: 460, color: '#8b9bff' },
      { label: '沙河街道', value: 380, color: '#ffb561' },
      { label: '兴华街道', value: 320, color: '#57b8ff' },
      { label: '元岗街道', value: 260, color: '#4de0d4' },
    ],
    community: [
      { label: '南村社区', value: 400, color: '#57b8ff' },
      { label: '石牌社区', value: 340, color: '#4de0d4' },
      { label: '珠江社区', value: 280, color: '#8b9bff' },
      { label: '新港社区', value: 240, color: '#ffb561' },
      { label: '棠下社区', value: 200, color: '#57b8ff' },
      { label: '华景社区', value: 170, color: '#4de0d4' },
      { label: '龙口社区', value: 140, color: '#8b9bff' },
      { label: '猎德社区', value: 110, color: '#ffb561' },
      { label: '洗村社区', value: 86, color: '#57b8ff' },
      { label: '车陂社区', value: 64, color: '#4de0d4' },
    ],
  },
};

let chartUid = 0;

const WORKBENCH_PAGE_SIZE = 4;
const WORKBENCH_SOURCE_MAP = {
  'basic-finished': 'basicFinished',
  'acceptance-rate': 'acceptanceRate',
  'closure-rate': 'closureRate',
  distribution: 'distribution',
  hotrank: 'hotrank',
  'hotrank-item': 'hotrank',
  'special-analysis-items': 'specialAnalysisItems',
  'province-acceptance': 'provinceAcceptance',
  'province-closure': 'provinceClosure',
  'province-distribution': 'provinceDistribution',
  'province-governance': 'provinceGovernance',
  'province-problem': 'provinceProblem',
  'province-hotrank': 'provinceHotrank',
  'province-hotrank-item': 'provinceHotrank',
  'province-trend': 'provinceTrend',
};
const WORKBENCH_SOURCE_LABELS = {
  basicFinished: '今日办结量 · 关联案件',
  acceptanceRate: '受理率 · 关联案件',
  closureRate: '办结率 · 关联案件',
  distribution: '工单类型分布 · 关联案件',
  hotrank: '事件热点 Top5 · 关联案件',
  specialAnalysisItems: '事项分析 · 关联案件',
  provinceAcceptance: '省预警受理指标 · 关联案件',
  provinceClosure: '省预警承办指标 · 关联案件',
  provinceDistribution: '省预警工单类型 · 关联案件',
  provinceGovernance: '重点治理热点 · 关联案件',
  provinceProblem: '热点问题排名 · 关联案件',
  provinceHotrank: '省预警区域热点 · 关联案件',
  provinceTrend: '全省热点趋势 · 关联案件',
};
const WORKBENCH_STATE = {
  isOpen: false,
  source: 'basicFinished',
  page: 1,
  pageSize: WORKBENCH_PAGE_SIZE,
  area: '',
  filterType: '',
  filterSource: '',
  filterDept: '',
  filterTopic: '',
  filterIssue: '',
};
const DETAIL_WORKBENCH_STATE = {
  isOpen: false,
  itemId: '',
};
const SPECIAL_ANALYSIS_KPI_DATA = [
  { key: 'response-rate', label: '工单响应率', value: 98.6, unit: '%', delta: '环比 +1.2%', deltaClass: 'up' },
  { key: 'resolve-rate', label: '解决率', value: 97.4, unit: '%', delta: '环比 +0.8%', deltaClass: 'up' },
  { key: 'consult-satisfaction', label: '咨询满意率', value: 99.1, unit: '%', delta: '环比 +0.5%', deltaClass: 'up' },
  { key: 'handling-satisfaction', label: '办理满意率', value: 96.8, unit: '%', delta: '环比 -0.2%', deltaClass: 'down' },
  { key: 'dispatch-satisfaction', label: '交办满意率', value: 97.9, unit: '%', delta: '环比 +0.6%', deltaClass: 'up' },
];
const SPECIAL_ANALYSIS_KPI_RANKING_DATA = {
  'response-rate': {
    subtitle: '工单响应率',
    top5: [
      { label: '天河区政务服务中心', value: 99.8, meta: '环比 +1.4%' },
      { label: '越秀区城运中心', value: 99.5, meta: '环比 +1.1%' },
      { label: '南山区综合治理办', value: 99.2, meta: '环比 +0.8%' },
      { label: '番禺区街面治理专班', value: 98.9, meta: '环比 +0.6%' },
      { label: '白云区热线联动中心', value: 98.7, meta: '环比 +0.5%' },
    ],
    bottom5: [
      { label: '宝安区热线联动中心', value: 94.6, meta: '环比 -0.8%' },
      { label: '海珠区综合治理办', value: 95.1, meta: '环比 -0.5%' },
      { label: '荔湾区城市治理办', value: 95.4, meta: '环比 -0.3%' },
      { label: '黄埔区民生服务中心', value: 95.8, meta: '环比 -0.1%' },
      { label: '福田区政务服务中心', value: 96.2, meta: '环比 +0.2%' },
    ],
  },
  'resolve-rate': {
    subtitle: '解决率',
    top5: [
      { label: '越秀区城运中心', value: 98.9, meta: '环比 +1.0%' },
      { label: '天河区政务服务中心', value: 98.6, meta: '环比 +0.9%' },
      { label: '白云区热线联动中心', value: 98.2, meta: '环比 +0.6%' },
      { label: '南山区综合治理办', value: 97.9, meta: '环比 +0.5%' },
      { label: '番禺区街面治理专班', value: 97.6, meta: '环比 +0.4%' },
    ],
    bottom5: [
      { label: '海珠区综合治理办', value: 92.8, meta: '环比 -0.9%' },
      { label: '宝安区热线联动中心', value: 93.4, meta: '环比 -0.7%' },
      { label: '黄埔区民生服务中心', value: 94.1, meta: '环比 -0.4%' },
      { label: '荔湾区城市治理办', value: 94.8, meta: '环比 -0.2%' },
      { label: '福田区政务服务中心', value: 95.3, meta: '环比 +0.1%' },
    ],
  },
  'consult-satisfaction': {
    subtitle: '咨询满意率',
    top5: [
      { label: '南山区综合治理办', value: 99.9, meta: '环比 +0.7%' },
      { label: '天河区政务服务中心', value: 99.7, meta: '环比 +0.6%' },
      { label: '越秀区城运中心', value: 99.6, meta: '环比 +0.5%' },
      { label: '白云区热线联动中心', value: 99.4, meta: '环比 +0.4%' },
      { label: '番禺区街面治理专班', value: 99.2, meta: '环比 +0.3%' },
    ],
    bottom5: [
      { label: '海珠区综合治理办', value: 95.6, meta: '环比 -0.6%' },
      { label: '宝安区热线联动中心', value: 96.1, meta: '环比 -0.4%' },
      { label: '黄埔区民生服务中心', value: 96.7, meta: '环比 -0.2%' },
      { label: '荔湾区城市治理办', value: 97.2, meta: '环比 +0.1%' },
      { label: '福田区政务服务中心', value: 97.8, meta: '环比 +0.2%' },
    ],
  },
  'handling-satisfaction': {
    subtitle: '办理满意率',
    top5: [
      { label: '天河区政务服务中心', value: 98.4, meta: '环比 +0.8%' },
      { label: '越秀区城运中心', value: 98.1, meta: '环比 +0.7%' },
      { label: '白云区热线联动中心', value: 97.7, meta: '环比 +0.5%' },
      { label: '番禺区街面治理专班', value: 97.4, meta: '环比 +0.3%' },
      { label: '南山区综合治理办', value: 97.1, meta: '环比 +0.2%' },
    ],
    bottom5: [
      { label: '宝安区热线联动中心', value: 91.9, meta: '环比 -1.2%' },
      { label: '海珠区综合治理办', value: 92.7, meta: '环比 -0.9%' },
      { label: '黄埔区民生服务中心', value: 93.6, meta: '环比 -0.6%' },
      { label: '荔湾区城市治理办', value: 94.2, meta: '环比 -0.4%' },
      { label: '福田区政务服务中心', value: 95.1, meta: '环比 -0.1%' },
    ],
  },
  'dispatch-satisfaction': {
    subtitle: '交办满意率',
    top5: [
      { label: '越秀区城运中心', value: 99.1, meta: '环比 +0.9%' },
      { label: '天河区政务服务中心', value: 98.8, meta: '环比 +0.8%' },
      { label: '番禺区街面治理专班', value: 98.4, meta: '环比 +0.6%' },
      { label: '白云区热线联动中心', value: 98.1, meta: '环比 +0.4%' },
      { label: '南山区综合治理办', value: 97.8, meta: '环比 +0.3%' },
    ],
    bottom5: [
      { label: '海珠区综合治理办', value: 93.2, meta: '环比 -0.7%' },
      { label: '宝安区热线联动中心', value: 93.9, meta: '环比 -0.5%' },
      { label: '黄埔区民生服务中心', value: 94.5, meta: '环比 -0.3%' },
      { label: '荔湾区城市治理办', value: 95.2, meta: '环比 -0.2%' },
      { label: '福田区政务服务中心', value: 95.8, meta: '环比 +0.1%' },
    ],
  },
};

window.particleField = particleField;
window.twinMapScenes = twinMapScenes;

function getScopedTopicSections(topic = activeTopic) {
  return Array.from(document.querySelectorAll(`[data-topic-content="${topic}"]`));
}

function getScopedTopicRoot(topic = activeTopic) {
  return getScopedTopicSections(topic)[0] ?? null;
}

function getScopedTopicElements(topic, selector) {
  return getScopedTopicSections(topic).flatMap((section) => Array.from(section.querySelectorAll(selector)));
}

function getScopedTopicElement(topic, selector) {
  for (const section of getScopedTopicSections(topic)) {
    const match = section.querySelector(selector);
    if (match) return match;
  }
  return null;
}

function getActiveCityTopic() {
  return CITY_TOPICS.includes(activeTopic) ? activeTopic : 'city-stats';
}

function getTimeFilterValue(topic) {
  return TIME_FILTER_STATE[topic] ?? TIME_FILTER_DEFAULT;
}

function setTimeFilterValue(topic, value) {
  TIME_FILTER_STATE[topic] = value;
}

function syncTimeFilterControls(topic = activeTopic) {
  document.querySelectorAll('[data-page-time-filter] select').forEach((select) => {
    select.value = getTimeFilterValue(topic);
  });
}


function rerenderTopicPanels(topic) {
  if (topic === 'province-warning') {
    renderProvinceWarningCards();
    return;
  }

  renderBasicInfoStats(topic);
  renderBusinessCharts();
  renderDistributionChart(topic);
  renderRankSummary(topic);
  renderRankList(topic);

  if (topic === 'appeal-map') {
    renderAppealHotItemChart(document.querySelector('[data-appeal-hotitem-tab.biz-hotrank__tab--active]')?.dataset.appealHotitemTab ?? 'level1');
    renderAppealRegionChart(document.querySelector('[data-appeal-region-tab.biz-hotrank__tab--active]')?.dataset.appealRegionTab ?? 'city');
    renderAppealNewItemChart(document.querySelector('[data-appeal-newitem-tab.biz-hotrank__tab--active]')?.dataset.appealNewitemTab ?? 'level1');
    renderAppealNewRegionChart(document.querySelector('[data-appeal-newregion-tab.biz-hotrank__tab--active]')?.dataset.appealNewregionTab ?? 'city');
  }
}

function getCityPanelState(topic = getActiveCityTopic()) {
  return CITY_PANEL_STATE[topic] ?? CITY_PANEL_STATE['city-stats'];
}

function getOrdersWorkbenchState(topic = getActiveCityTopic()) {
  return ORDERS_WORKBENCH_STATE[topic] ?? ORDERS_WORKBENCH_STATE['city-stats'];
}

function updateClock() {
  if (!clock) return;

  const formatter = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  clock.textContent = formatter.format(new Date());
}

function updateStageScale() {
  if (!stageRoot) return;
  const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
  document.documentElement.style.setProperty('--dt-stage-scale', String(scale));
}

function handleResize() {
  updateStageScale();
  particleField?.resize();
  twinMapScenes.forEach((scene) => scene.resize());
  renderBusinessCharts();
}

function easeOutCubic(progress) {
  return 1 - (1 - progress) ** 3;
}

function formatCount(value, format) {
  if (format === 'decimal1') return value.toFixed(1);
  if (format === 'percent') return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString('en-US');
}

function animateCount(node) {
  const target = Number(node.dataset.countTo ?? 0);
  const format = node.dataset.countFormat ?? 'integer';
  if (prefersReducedMotion.matches) {
    node.textContent = formatCount(target, format);
    return;
  }

  const duration = Number(node.dataset.countDuration ?? 900);
  const start = performance.now();
  const from = 0;

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const value = from + (target - from) * easeOutCubic(progress);
    node.textContent = formatCount(value, format);
    if (progress < 1) {
      window.requestAnimationFrame(tick);
    }
  };

  window.requestAnimationFrame(tick);
}

function animateCounts(root = document) {
  root.querySelectorAll('[data-count-to]').forEach((node) => animateCount(node));
}

function buildLinePath(points, width, height) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function nextChartId(prefix) {
  chartUid += 1;
  return `${prefix}-${chartUid}`;
}

function renderSparkline(container, points) {
  const width = container.clientWidth || 240;
  const height = container.clientHeight || 72;
  const path = buildLinePath(points, width, height - 8);
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  const gradientId = nextChartId('spark-fill');
  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--dt-chart-fill)" />
          <stop offset="100%" stop-color="rgba(100, 199, 199, 0.01)" />
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${gradientId})"></path>
      <path d="${path}" fill="none" stroke="var(--dt-chart-line)" stroke-width="2"></path>
    </svg>
  `;
}

function renderTrendChart(container, points) {
  const width = container.clientWidth || 240;
  const height = container.clientHeight || 116;
  const path = buildLinePath(points, width, height - 18);
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const gradientId = nextChartId('trend-fill');
  const dotIndexes = [0, 5, 11, 17, points.length - 1].filter((index, pos, arr) => arr.indexOf(index) === pos);
  const dots = dotIndexes
    .map((index) => {
      const value = points[index];
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - 18 - ((value - min) / range) * (height - 18);
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.8" fill="var(--dt-chart-dot)"></circle>`;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--dt-chart-fill)" />
          <stop offset="100%" stop-color="rgba(100, 199, 199, 0.01)" />
        </linearGradient>
      </defs>
      <line x1="0" x2="${width}" y1="${height - 1}" y2="${height - 1}" stroke="var(--dt-chart-line-dim)" stroke-width="1"></line>
      <path d="${area}" fill="url(#${gradientId})"></path>
      <path d="${path}" fill="none" stroke="var(--dt-chart-line)" stroke-width="2.2"></path>
      ${dots}
    </svg>
  `;
}

function renderSeverityBar(container, values) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const widths = values.map((value) => (value / total) * 100);
  container.innerHTML = `
    <svg viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="0" width="${widths[0]}" height="14" rx="7" fill="var(--dt-risk-high)"></rect>
      <rect x="${widths[0]}" y="0" width="${widths[1]}" height="14" fill="var(--dt-risk-medium)"></rect>
      <rect x="${widths[0] + widths[1]}" y="0" width="${widths[2]}" height="14" rx="7" fill="var(--dt-risk-low)"></rect>
    </svg>
  `;
}

function polarToCartesian(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function renderFanDistributionChart(container, items) {
  if (!container) return;

  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const cx = 96;
  const cy = 96;
  const radius = 74;
  let startAngle = -Math.PI / 2;

  const slices = items
    .map((item) => {
      const angle = (item.value / total) * Math.PI * 2;
      const path = describeArc(cx, cy, radius, startAngle, startAngle + angle);
      startAngle += angle;
      const jumpAttrs = item.ordersJump
        ? ` data-orders-jump="${item.ordersJump}" data-orders-value="${item.ordersValue ?? item.label}" role="button" tabindex="0" aria-label="${item.ariaLabel ?? `查看${item.label}关联案件`}"`
        : ' aria-hidden="true"';
      return `<path class="biz-distribution__slice${item.ordersJump ? ' biz-distribution__slice--interactive' : ''}" d="${path}" fill="${item.color}"${jumpAttrs}></path>`;
    })
    .join('');

  const legend = items
    .map((item) => {
      const percent = ((item.value / total) * 100).toFixed(0);
      const tag = item.ordersJump ? 'button' : 'div';
      const jumpAttrs = item.ordersJump
        ? ` type="button" data-orders-jump="${item.ordersJump}" data-orders-value="${item.ordersValue ?? item.label}" aria-label="${item.ariaLabel ?? `查看${item.label}关联案件`}"`
        : '';
      return `
        <${tag} class="biz-distribution__legend-item"${jumpAttrs}>
          <span class="biz-distribution__legend-main">
            <span class="biz-distribution__legend-dot" style="background:${item.color}"></span>
            <span class="biz-distribution__legend-label">${item.label}</span>
          </span>
          <span class="biz-distribution__legend-value">${percent}%</span>
        </${tag}>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="biz-distribution__chart-wrap">
      <svg viewBox="0 0 192 192" class="biz-distribution__chart" aria-hidden="true" focusable="false">
        <circle cx="96" cy="96" r="82" fill="rgba(9, 20, 34, 0.36)" stroke="rgba(96, 194, 255, 0.1)" stroke-width="1"></circle>
        ${slices}
        <circle cx="96" cy="96" r="34" fill="rgba(8, 18, 32, 0.94)" stroke="rgba(148, 220, 255, 0.14)" stroke-width="1"></circle>
      </svg>
    </div>
    <div class="biz-distribution__legend">${legend}</div>
  `;
}

function renderDistributionChart(topic = 'city-stats') {
  getScopedTopicElements(topic, '[data-distribution-chart]').forEach((container) => {
    renderFanDistributionChart(container, BUSINESS_DATA.distribution);
  });
}

function renderStatGrid(container, items) {
  if (!container) return;
  container.innerHTML = items
    .map((item) => {
      const attrs = item.triggerSource
        ? ` data-workbench-trigger="${item.triggerSource}"${item.triggerArea ? ` data-workbench-area="${item.triggerArea}"` : ''} role="button" tabindex="0" aria-label="${item.ariaLabel ?? `打开${item.label}关联案件列表`}"`
        : item.ordersJump
          ? ` data-orders-jump="${item.ordersJump}" data-orders-value="${item.ordersValue ?? item.label}" role="button" tabindex="0" aria-label="${item.ariaLabel ?? `打开${item.label}关联案件列表`}"`
          : '';
      return `
        <article class="biz-stat${item.compact ? ' biz-stat--compact' : ''}"${attrs}>
          <span class="biz-stat__label">${item.label}</span>
          <div class="biz-panel__value-row">
            <span class="biz-stat__value" data-count-to="${item.value}" data-count-format="${item.format ?? 'integer'}">0</span>
            <span class="biz-stat__unit">${item.unit ?? ''}</span>
          </div>
          ${item.delta ? `<span class="biz-stat__delta biz-stat__delta--${item.deltaClass ?? 'up'}">${item.delta}</span>` : ''}
        </article>
      `;
    })
    .join('');
}

function renderBasicInfoStats(topic = 'city-stats') {
  getScopedTopicElements(topic, '[data-basic-info-stats]').forEach((container) => {
    container.innerHTML = BUSINESS_DATA.overview.basicInfo
      .map((item) => {
        let triggerAttr = '';
        if (item.label === '今日办结量') {
          triggerAttr = ' data-workbench-trigger="basic-finished" role="button" tabindex="0" aria-label="打开今日办结量案件列表"';
        } else if (item.label === '今日工单量') {
          triggerAttr = ' data-orders-workbench-trigger="orders-volume" role="button" tabindex="0" aria-label="打开工单量详情工作台"';
        }
        return `
          <article class="biz-basicinfo__item"${triggerAttr}>
            <div class="biz-basicinfo__item-head">
              <span class="biz-basicinfo__item-title">${item.label}</span>
            </div>
            <div class="biz-basicinfo__value-row">
              <span class="biz-basicinfo__value" data-count-to="${item.value}" data-count-format="integer">0</span>
              <span class="biz-basicinfo__unit">${item.unit}</span>
            </div>
            <div class="biz-basicinfo__meta-row">
              <span class="biz-basicinfo__meta">${item.yoy}</span>
              <span class="biz-basicinfo__meta">${item.qoq}</span>
            </div>
          </article>
        `;
      })
      .join('');
  });
}

function getSpecialAnalysisKpiData() {
  return SPECIAL_ANALYSIS_KPI_DATA;
}

function renderSpecialAnalysisKpiOverlay() {
  const container = getScopedTopicElement('special-analysis', '[data-special-analysis-kpi]');
  if (!container) return;

  const items = getSpecialAnalysisKpiData();
  container.innerHTML = `
    <div class="special-analysis-kpi-overlay__frame">
      <div class="special-analysis-kpi-overlay__list">
        ${items
          .map(
            (item) => `
              <article class="special-analysis-kpi-overlay__item" data-special-analysis-orders-trigger="kpi-unit-ranking" data-special-analysis-kpi-trigger="${item.key}" data-special-analysis-kpi-item="${item.key}" role="button" tabindex="0" aria-label="查看${item.label}单位排名">
                <span class="special-analysis-kpi-overlay__label">${item.label}</span>
                <div class="special-analysis-kpi-overlay__value-row">
                  <span class="special-analysis-kpi-overlay__value" data-count-to="${item.value}" data-count-format="percent">0%</span>
                </div>
                <span class="special-analysis-kpi-overlay__delta special-analysis-kpi-overlay__delta--${item.deltaClass}">${item.delta}</span>
              </article>
            `
          )
          .join('')}
      </div>
    </div>
  `;

  animateCounts(container);
}

function renderRankSummary(topic = 'city-stats') {
  const { summary } = BUSINESS_DATA.districtRanking;
  getScopedTopicElements(topic, '[data-rank-summary]').forEach((container) => {
    container.innerHTML = `
      <div class="biz-hotrank__summary-main">
        <span class="biz-hotrank__summary-label">${summary.label}</span>
        <div class="biz-panel__value-row">
          <span class="biz-trend__value" data-count-to="${summary.value}" data-count-format="integer">0</span>
          <span class="dt-metric__unit">${summary.unit}</span>
        </div>
      </div>
      <div class="biz-hotrank__summary-side">
        <span class="biz-panel__compare biz-panel__compare--up">${summary.compare}</span>
        <span class="biz-hotrank__metric">${summary.note}</span>
      </div>
    `;
  });
}

function renderRankList(topic = 'city-stats') {
  getScopedTopicElements(topic, '[data-rank-list]').forEach((container) => {
    container.innerHTML = BUSINESS_DATA.districtRanking.items
      .slice(0, 5)
      .map((item, index) => {
        const rank = index + 1;
        const badgeClass = rank === 1 ? 'biz-hotrank__badge--medal1' : rank === 2 ? 'biz-hotrank__badge--medal2' : rank === 3 ? 'biz-hotrank__badge--medal3' : 'biz-hotrank__badge--num';
        return `
          <article class="biz-hotrank__item" data-workbench-trigger="hotrank-item" data-workbench-area="${item.name}" role="button" tabindex="0" aria-label="打开${item.name}案件列表">
            <div class="biz-hotrank__rank">
              <span class="biz-hotrank__badge ${badgeClass}">${rank}</span>
            </div>
            <span class="biz-hotrank__region">${item.name}</span>
            <span class="biz-hotrank__value">${item.count.toLocaleString('en-US')}</span>
            <div>
              <span class="biz-hotrank__delta">${item.delta}</span>
              <div class="biz-hotrank__metric">${item.metric}</div>
            </div>
          </article>
        `;
      })
      .join('');
  });
}

function renderRiskList() {
  const container = document.querySelector('[data-risk-list]');
  if (!container) return;
  container.innerHTML = BUSINESS_DATA.risks
    .map(
      (item) => `
        <article class="biz-risk-item biz-risk-item--${item.level}">
          <div class="biz-risk-item__head">
            <div>
              <div class="biz-risk-item__title">${item.title}</div>
              <div class="biz-risk-item__sub">${item.area} · ${item.source}</div>
            </div>
            <span class="dt-chip biz-chip biz-chip--${item.level}">${item.level === 'high' ? '红色' : item.level === 'medium' ? '橙黄' : '蓝色'}</span>
          </div>
          <div class="biz-risk-item__meta">
            <span>责任部门：${item.dept}</span>
            <span>持续 ${item.duration}</span>
          </div>
          <div class="biz-risk-item__meta">
            <span class="biz-risk-item__status">${item.status}</span>
          </div>
        </article>
      `
    )
    .join('');
}

function renderFlowList(container = document.querySelector('[data-flow-list]'), items = BUSINESS_DATA.workorderFlow, limit = items.length) {
  if (!container) return;
  container.innerHTML = items
    .slice(0, limit)
    .map(
      (item) => `
        <article class="biz-flow-item">
          <div class="biz-flow-item__head">
            <div class="biz-flow-item__left">
              <span class="biz-flow-item__pulse"></span>
              <div>
                <div class="biz-flow-item__title">${item.title}</div>
                <div class="biz-flow-item__sub">${item.area} · ${item.source}</div>
              </div>
            </div>
            <span class="dt-chip biz-chip biz-chip--${item.level === 'high' ? 'high' : item.level === 'medium' ? 'medium' : 'low'}">${item.status}</span>
          </div>
          <div class="biz-flow-item__meta">
            <span>承办部门：${item.dept}</span>
            <span>已流转 ${item.elapsed}</span>
          </div>
        </article>
      `
    )
    .join('');
}

function renderDepartmentList() {
  const container = document.querySelector('[data-department-list]');
  if (!container) return;
  container.innerHTML = BUSINESS_DATA.departments
    .map(
      (item) => `
        <article class="biz-department-item">
          <div class="biz-department-item__head">
            <span class="biz-department-item__name">${item.name}</span>
            <span class="biz-status-light biz-status-light--${item.status.includes('待') ? 'warning' : item.status.includes('协同') || item.status.includes('联动') ? 'alert' : 'normal'}">${item.status}</span>
          </div>
          <div class="biz-department-item__meta">${item.detail}</div>
        </article>
      `
    )
    .join('');
}

function renderMapContext() {
  document.querySelectorAll('[data-map-context]').forEach((container) => {
    const key = container.dataset.mapContext;
    const data = BUSINESS_DATA.mapContext[key];
    if (!data) return;
    container.innerHTML = `
      <strong class="biz-dock__value">${data.title}</strong>
      <span class="biz-dock__hint">${data.main}</span>
      ${data.meta
        .map(
          (item) => `
            <div class="biz-dock__meta">
              <span>${item.label}</span>
              <strong>${item.value}</strong>
            </div>
          `
        )
        .join('')}
    `;
  });
}

function getCityMetrics(cityName) {
  return BUSINESS_DATA.cityMetrics[cityName] ?? null;
}

function getCityScenic(cityName) {
  const scenicMap = {
    广州市: [
      { name: '广州塔', address: '海珠区阅江西路 222 号', imageLabel: '城市地标' },
      { name: '白云山风景区', address: '白云区广园中路白云山景区', imageLabel: '山体景观' },
      { name: '永庆坊', address: '荔湾区恩宁路 99 号片区', imageLabel: '历史街区' },
    ],
    深圳市: [
      { name: '深圳湾公园', address: '南山区滨海大道深圳湾沿线', imageLabel: '滨海景观' },
      { name: '莲花山公园', address: '福田区红荔路 6030 号', imageLabel: '城市公园' },
      { name: '大梅沙海滨公园', address: '盐田区盐梅路 105 号', imageLabel: '海岸风光' },
    ],
    佛山市: [
      { name: '西樵山风景名胜区', address: '南海区西樵镇环山大道', imageLabel: '山岳景区' },
      { name: '清晖园', address: '顺德区大良清晖路 23 号', imageLabel: '岭南园林' },
      { name: '岭南天地', address: '禅城区祖庙东华里中心地段', imageLabel: '街区夜景' },
    ],
    珠海市: [
      { name: '情侣路', address: '香洲区滨海沿线情侣中路', imageLabel: '海岸长廊' },
      { name: '日月贝', address: '香洲区野狸岛海滨歌剧院', imageLabel: '城市建筑' },
      { name: '外伶仃岛', address: '珠海市担杆镇外伶仃岛景区', imageLabel: '海岛风光' },
    ],
    东莞市: [
      { name: '松山湖风景区', address: '松山湖高新区大学路片区', imageLabel: '湖区景观' },
      { name: '可园博物馆', address: '莞城区可园路 32 号', imageLabel: '岭南园林' },
      { name: '观音山国家森林公园', address: '樟木头镇石新社区笔架山大道', imageLabel: '森林景观' },
    ],
  };

  if (scenicMap[cityName]) return scenicMap[cityName];

  return [
    { name: `${cityName.replace(/市$/, '')}城市地标`, address: `${cityName}中心城区核心片区`, imageLabel: '城市地标' },
    { name: `${cityName.replace(/市$/, '')}生态景观带`, address: `${cityName}滨水或生态景观廊道`, imageLabel: '生态景观' },
    { name: `${cityName.replace(/市$/, '')}历史文化街区`, address: `${cityName}重点文旅展示片区`, imageLabel: '文旅街区' },
  ];
}

function renderCityPanel(topic = getActiveCityTopic()) {
  const root = getScopedTopicElement(topic, '[data-city-panel]');
  const title = getScopedTopicElement(topic, '[data-city-panel-title]');
  const body = getScopedTopicElement(topic, '[data-city-panel-body]');
  if (!root || !title || !body) return;

  const state = getCityPanelState(topic);
  root.dataset.cityPanelState = state.isOpen ? 'open' : 'closed';

  if (!state.isOpen) {
    title.textContent = '地市联动';
    body.innerHTML = '';
    return;
  }

  const metrics = getCityMetrics(state.cityName);
  const scenic = getCityScenic(state.cityName);
  title.textContent = state.cityName || '地市联动';

  if (!metrics?.length) {
    body.innerHTML = `
      <div class="map-city-panel__empty">
        <span class="map-city-panel__empty-label">暂无联动指标</span>
        <span class="map-city-panel__empty-note">当前地市未接入实时六项指标。</span>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div class="map-city-panel__section">
      <div class="map-city-panel__grid">
        ${metrics
          .map(
            (item) => `
              <article class="map-city-panel__card">
                <span class="map-city-panel__card-label">${item.label}</span>
                <div class="map-city-panel__card-value-row">
                  <span class="map-city-panel__card-value" data-count-to="${item.value}" data-count-format="${item.format ?? 'integer'}">0</span>
                  <span class="map-city-panel__card-unit">${item.unit}</span>
                </div>
                <span class="map-city-panel__card-note">${item.note}</span>
              </article>
            `
          )
          .join('')}
      </div>
    </div>
    <section class="map-city-panel__section map-city-panel__section--scenic">
      <div class="map-city-panel__section-head">
        <span class="map-city-panel__section-title">特色景色</span>
        <span class="map-city-panel__section-note">图片、景点名称、地址</span>
      </div>
      <div class="map-city-panel__scenic-list">
        ${scenic
          .map(
            (item, index) => `
              <article class="map-city-panel__scenic-card">
                <div class="map-city-panel__scenic-media" aria-hidden="true">
                  <div class="map-city-panel__scenic-scan"></div>
                  <div class="map-city-panel__scenic-badge">IMG ${String(index + 1).padStart(2, '0')}</div>
                  <div class="map-city-panel__scenic-image-label">${item.imageLabel}</div>
                </div>
                <div class="map-city-panel__scenic-copy">
                  <span class="map-city-panel__scenic-name">${item.name}</span>
                  <span class="map-city-panel__scenic-address">${item.address}</span>
                </div>
              </article>
            `
          )
          .join('')}
      </div>
    </section>
  `;

  animateCounts(body);
}

function drilldownToCity(region, topic) {
  if (!region?.name) return;
  const breadcrumb = getScopedTopicElement(topic, '[data-breadcrumb]');
  const cityLabel = getScopedTopicElement(topic, '[data-breadcrumb-city]');
  if (breadcrumb) breadcrumb.dataset.breadcrumbState = 'drilled';
  if (cityLabel) cityLabel.textContent = region.name;
  twinMapScenes.get(topic)?.drilldownToCity(region);
}

function drillbackToProvince(topic) {
  const breadcrumb = getScopedTopicElement(topic, '[data-breadcrumb]');
  const cityLabel = getScopedTopicElement(topic, '[data-breadcrumb-city]');
  if (breadcrumb) {
    delete breadcrumb.dataset.breadcrumbState;
  }
  if (cityLabel) cityLabel.textContent = '';
  twinMapScenes.get(topic)?.resetView();
}

function openCityPanel(cityName, topic = getActiveCityTopic()) {
  if (!cityName) return;
  const state = getCityPanelState(topic);
  state.isOpen = true;
  state.cityName = cityName;
  renderCityPanel(topic);
}

function closeCityPanel(topic = getActiveCityTopic()) {
  const state = getCityPanelState(topic);
  state.isOpen = false;
  state.cityName = '';
  renderCityPanel(topic);
  if (topic === 'appeal-map') {
    twinMapScenes.get(topic)?.resetView();
  }
}

function renderViewportCards() {
  const summary = document.querySelector('[data-viewport-summary]');
  const metrics = document.querySelector('[data-viewport-metrics]');
  const legend = document.querySelector('[data-viewport-legend]');
  const { viewport } = BUSINESS_DATA;

  if (summary) {
    summary.innerHTML = `
      <span class="viewport-card__eyebrow">${viewport.summary.eyebrow}</span>
      <div class="viewport-card__hero-row">
        <span class="viewport-card__value" data-count-to="${viewport.summary.value}" data-count-format="integer">0</span>
        <span class="viewport-card__unit">${viewport.summary.unit}</span>
      </div>
      <strong class="viewport-card__title">${viewport.summary.title}</strong>
      <div class="viewport-card__compare-row">
        ${viewport.summary.compare.map((item) => `<span class="viewport-card__compare">${item}</span>`).join('')}
      </div>
    `;
  }

  if (metrics) {
    metrics.innerHTML = `
      <div class="viewport-card__mini-grid">
        ${viewport.metrics
          .map(
            (item) => `
              <div class="viewport-card__mini-item">
                <span>${item.label}</span>
                <strong>${item.value}</strong>
              </div>
            `
          )
          .join('')}
      </div>
    `;
  }

  if (legend) {
    legend.innerHTML = `
      <div class="viewport-card__legend-list">
        ${viewport.legend
          .map(
            (item) => `
              <div class="viewport-card__legend-item">
                <span class="viewport-card__legend-dot viewport-card__legend-dot--${item.level}"></span>
                <span>${item.label}</span>
                <strong>${item.value}</strong>
              </div>
            `
          )
          .join('')}
      </div>
    `;
  }
}

function renderBulletinStrip() {
  const container = document.querySelector('[data-bulletin-strip]');
  if (!container) return;
  container.innerHTML = BUSINESS_DATA.bulletin
    .map(
      (item) => `
        <div class="status-bulletin__item">
          <span class="status-bulletin__time">${item.time}</span>
          <span class="status-bulletin__dept">${item.dept}</span>
          <span class="status-bulletin__text">${item.text}</span>
        </div>
      `
    )
    .join('');
}

function normalizeWorkbenchArea(value) {
  if (!value) return '';
  return value.endsWith('市') ? value : `${value}市`;
}

function getWorkbenchDataset() {
  const dataset = BUSINESS_DATA.workbench[WORKBENCH_STATE.source] ?? BUSINESS_DATA.workbench.basicFinished;
  let summaryLabel = dataset.summaryLabel;
  let accent = dataset.accent;
  let items = [...dataset.items];

  if (WORKBENCH_STATE.area) {
    const normalizedArea = normalizeWorkbenchArea(WORKBENCH_STATE.area);
    summaryLabel = `${WORKBENCH_STATE.area} · 热点关联案件`;
    accent = `${WORKBENCH_STATE.area} · 重点关注`;
    items = items.filter((item) => item.area.includes(WORKBENCH_STATE.area) || item.area.includes(normalizedArea));
  }

  if (WORKBENCH_STATE.filterSource) {
    summaryLabel = `${WORKBENCH_STATE.filterSource} · 渠道关联案件`;
    accent = `${WORKBENCH_STATE.filterSource} 渠道分布`;
    items = items.filter((item) => item.source.includes(WORKBENCH_STATE.filterSource));
  }

  if (WORKBENCH_STATE.filterType) {
    summaryLabel = `${WORKBENCH_STATE.filterType} · 类型关联案件`;
    accent = `${WORKBENCH_STATE.filterType} 工单类型`;
    items = items.filter((item) => item.type.includes(WORKBENCH_STATE.filterType));
  }

  if (WORKBENCH_STATE.filterDept) {
    summaryLabel = `${WORKBENCH_STATE.filterDept} · 承办关联案件`;
    accent = `${WORKBENCH_STATE.filterDept} 承办量`;
    items = items.filter((item) => item.area.includes(WORKBENCH_STATE.filterDept) || item.dept.includes(WORKBENCH_STATE.filterDept));
  }

  if (WORKBENCH_STATE.filterTopic) {
    summaryLabel = `${WORKBENCH_STATE.filterTopic} · 治理热点关联案件`;
    accent = `${WORKBENCH_STATE.filterTopic} 重点治理`;
    items = items.filter((item) => item.topic?.includes(WORKBENCH_STATE.filterTopic));
  }

  if (WORKBENCH_STATE.filterIssue) {
    summaryLabel = `${WORKBENCH_STATE.filterIssue} · 热点问题关联案件`;
    accent = `${WORKBENCH_STATE.filterIssue} 问题排名`;
    items = items.filter((item) => item.issue?.includes(WORKBENCH_STATE.filterIssue));
  }

  return {
    ...dataset,
    summaryLabel,
    accent,
    items,
  };
}

function renderWorkbenchSummary(container, dataset) {
  container.innerHTML = `
    <div class="map-workbench__summary-main">
      <span class="map-workbench__summary-label">${dataset.summaryLabel}</span>
      <strong class="map-workbench__summary-accent">${dataset.accent}</strong>
    </div>
    <div class="map-workbench__summary-side">
      <span class="map-workbench__summary-count">案件 ${dataset.items.length} 条</span>
      <span class="map-workbench__summary-page">第 ${WORKBENCH_STATE.page} / ${Math.max(Math.ceil(dataset.items.length / WORKBENCH_STATE.pageSize), 1)} 页</span>
    </div>
  `;
}

function renderVerticalBarChart(container, items, triggerType) {
  if (!container) return;
  const max = Math.max(...items.map((item) => item.value), 1);
  container.innerHTML = `
    <div class="map-orders-bars">
      ${items
        .map(
          (item) => `
            <div class="map-orders-bars__item">
              <button class="map-orders-bars__trigger" type="button" data-orders-jump="${triggerType}" data-orders-value="${item.label}" aria-label="查看${item.label}关联案件">
                <span class="map-orders-bars__track">
                  <span class="map-orders-bars__bar" style="height:${(item.value / max) * 100}%;background:${item.color}"></span>
                </span>
                <span class="map-orders-bars__value">${item.value}%</span>
                <span class="map-orders-bars__label">${item.label}</span>
              </button>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderProvinceSharedAxisBarChart(container, items) {
  if (!container) return;
  const width = container.clientWidth || 460;
  const height = container.clientHeight || 220;
  const baselineY = height - 28;
  const chartHeight = height - 48;
  const max = Math.max(...items.map((item) => item.value), 1);
  const slotWidth = width / Math.max(items.length, 1);
  const barWidth = Math.min(34, slotWidth * 0.5);
  const bars = items
    .map((item, index) => {
      const x = slotWidth * index + (slotWidth - barWidth) / 2;
      const barHeight = (item.value / max) * chartHeight;
      const y = baselineY - barHeight;
      return `
        <g class="province-bar-chart__item" data-workbench-trigger="${item.triggerSource ?? 'province-hotrank-item'}" data-workbench-area="${item.triggerArea ?? item.label}" role="button" tabindex="0" aria-label="${item.ariaLabel ?? `查看${item.label}关联案件`}">
          <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="5" fill="${item.color ?? '#57b8ff'}"></rect>
          <text x="${(x + barWidth / 2).toFixed(2)}" y="${(y - 8).toFixed(2)}" fill="rgba(220,245,255,0.88)" font-size="10" text-anchor="middle">${item.value}</text>
          <text x="${(x + barWidth / 2).toFixed(2)}" y="${(height - 8).toFixed(2)}" fill="rgba(152,188,208,0.72)" font-size="10" text-anchor="middle">${item.label}</text>
        </g>
      `;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="0" x2="${width}" y1="${baselineY}" y2="${baselineY}" stroke="var(--dt-chart-line-dim)" stroke-width="1"></line>
      ${bars}
    </svg>
  `;
}

function renderHorizontalRankChart(container, items, options = {}) {
  if (!container) return;
  const max = Math.max(...items.map((item) => item.value), 1);
  const jumpKind = options.jumpKind ?? 'rank';
  container.innerHTML = `
    <div class="map-orders-rank">
      ${items
        .map(
          (item, index) => `
            <button class="map-orders-rank__item" type="button" data-orders-jump="${item.ordersJump ?? jumpKind}" data-orders-value="${item.ordersValue ?? item.label}" aria-label="${item.ariaLabel ?? `查看${item.label}关联案件`}">
              <span class="map-orders-rank__index">${index + 1}</span>
              <div class="map-orders-rank__main">
                <div class="map-orders-rank__head">
                  <span class="map-orders-rank__label">${item.label}</span>
                  <span class="map-orders-rank__value">${item.value.toLocaleString('en-US')}</span>
                </div>
                <div class="map-orders-rank__track">
                  <span class="map-orders-rank__bar" style="width:${(item.value / max) * 100}%"></span>
                </div>
              </div>
            </button>
          `
        )
        .join('')}
    </div>
  `;
}

function renderAppealHotItemChart(tabKey = 'level1') {
  const container = document.querySelector('[data-appeal-hotitem-chart]');
  if (!container) return;
  const items = BUSINESS_DATA.appealHotItem[tabKey] ?? [];
  renderHorizontalRankChart(container, items, { jumpKind: 'appeal-hotitem' });
}

function renderAppealRegionChart(tabKey = 'city') {
  const container = document.querySelector('[data-appeal-region-chart]');
  if (!container) return;
  const items = BUSINESS_DATA.appealRegion[tabKey] ?? [];
  renderProvinceSharedAxisBarChart(container, items);
}

function bindAppealHotItemTabs() {
  const tabBar = document.querySelector('[data-appeal-hotitem-tabs]');
  if (!tabBar) return;
  tabBar.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-appeal-hotitem-tab]');
    if (!tab) return;
    tabBar.querySelectorAll('[data-appeal-hotitem-tab]').forEach((t) => t.classList.remove('biz-hotrank__tab--active'));
    tab.classList.add('biz-hotrank__tab--active');
    renderAppealHotItemChart(tab.dataset.appealHotitemTab);
  });
}

function bindAppealRegionTabs() {
  const tabBar = document.querySelector('[data-appeal-region-tabs]');
  if (!tabBar) return;
  tabBar.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-appeal-region-tab]');
    if (!tab) return;
    tabBar.querySelectorAll('[data-appeal-region-tab]').forEach((t) => t.classList.remove('biz-hotrank__tab--active'));
    tab.classList.add('biz-hotrank__tab--active');
    renderAppealRegionChart(tab.dataset.appealRegionTab);
  });
}

function renderAppealNewItemChart(tabKey = 'level1') {
  const container = document.querySelector('[data-appeal-newitem-chart]');
  if (!container) return;
  const items = BUSINESS_DATA.appealNewItem[tabKey] ?? [];
  renderNewItemRankChart(container, items);
}

function renderNewItemRankChart(container, items) {
  if (!container) return;
  const getRatioColor = (ratio) => {
    if (ratio > 10) return 'red';
    if (ratio > 0) return 'yellow';
    return 'green';
  };
  const formatRatio = (ratio) => {
    const sign = ratio > 0 ? '+' : '';
    return `${sign}${ratio}%`;
  };
  container.innerHTML = `
    <div class="newitem-rank">
      ${items.map((item, index) => {
        const color = getRatioColor(item.ratio);
        return `
          <button class="newitem-rank__row" type="button" data-orders-jump="appeal-hotitem" data-orders-value="${item.label}" aria-label="查看${item.label}事项详情">
            <span class="newitem-rank__index">${index + 1}</span>
            <span class="newitem-rank__label">${item.label}</span>
            <span class="newitem-rank__trend newitem-rank__trend--${color}">
              <svg class="newitem-rank__icon" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 2L10 7H2L6 2Z"/>
              </svg>
              <span class="newitem-rank__ratio">${formatRatio(item.ratio)}</span>
            </span>
            <span class="newitem-rank__value">${item.value.toLocaleString('en-US')}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderAppealNewRegionChart(tabKey = 'city') {
  const container = document.querySelector('[data-appeal-newregion-chart]');
  if (!container) return;
  const items = BUSINESS_DATA.appealNewRegion[tabKey] ?? [];
  renderProvinceSharedAxisBarChart(container, items);
}

function bindAppealNewItemTabs() {
  const tabBar = document.querySelector('[data-appeal-newitem-tabs]');
  if (!tabBar) return;
  tabBar.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-appeal-newitem-tab]');
    if (!tab) return;
    tabBar.querySelectorAll('[data-appeal-newitem-tab]').forEach((t) => t.classList.remove('biz-hotrank__tab--active'));
    tab.classList.add('biz-hotrank__tab--active');
    renderAppealNewItemChart(tab.dataset.appealNewitemTab);
  });
}

function bindAppealNewRegionTabs() {
  const tabBar = document.querySelector('[data-appeal-newregion-tabs]');
  if (!tabBar) return;
  tabBar.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-appeal-newregion-tab]');
    if (!tab) return;
    tabBar.querySelectorAll('[data-appeal-newregion-tab]').forEach((t) => t.classList.remove('biz-hotrank__tab--active'));
    tab.classList.add('biz-hotrank__tab--active');
    renderAppealNewRegionChart(tab.dataset.appealNewregionTab);
  });
}

function bindTimeFilters() {
  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-page-time-filter] select');
    if (!select) return;
    setTimeFilterValue(activeTopic, select.value);
    rerenderTopicPanels(activeTopic);
    syncTimeFilterControls(activeTopic);
  });
}

function renderOrdersTrendChart(container, points, labels) {
  if (!container) return;
  const width = container.clientWidth || 340;
  const height = container.clientHeight || 176;
  const path = buildLinePath(points, width - 10, height - 34);
  const area = `${path} L ${width - 10} ${height - 24} L 0 ${height - 24} Z`;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const labelStep = Math.max(Math.floor(labels.length / 4), 1);
  const axisLabels = labels
    .map((label, index) => {
      if (index % labelStep !== 0 && index !== labels.length - 1) return '';
      const x = (index / Math.max(labels.length - 1, 1)) * (width - 10);
      return `<text x="${x.toFixed(2)}" y="${height - 6}" fill="rgba(152,188,208,0.72)" font-size="10" text-anchor="middle">${label}</text>`;
    })
    .join('');
  const dots = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * (width - 10);
      const y = height - 34 - ((value - min) / range) * (height - 44);
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.6" fill="var(--dt-chart-dot)"></circle>`;
    })
    .join('');
  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="orders-trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(100, 199, 199, 0.2)" />
          <stop offset="100%" stop-color="rgba(100, 199, 199, 0.02)" />
        </linearGradient>
      </defs>
      <line x1="0" x2="${width}" y1="${height - 24}" y2="${height - 24}" stroke="var(--dt-chart-line-dim)" stroke-width="1"></line>
      <path d="${area}" fill="url(#orders-trend-fill)"></path>
      <path d="${path}" fill="none" stroke="var(--dt-chart-line)" stroke-width="2.2"></path>
      ${dots}
      ${axisLabels}
    </svg>
  `;
}

function buildProvinceWorkorderStats(acceptanceStats, handlingStats) {
  return [
    ...acceptanceStats.slice(0, 3).map((item) => ({
      ...item,
      triggerSource: 'province-acceptance',
      ariaLabel: `打开${item.label}关联案件列表`,
    })),
    ...handlingStats.slice(0, 3).map((item) => ({
      ...item,
      triggerSource: 'province-closure',
      ariaLabel: `打开${item.label}关联案件列表`,
    })),
  ];
}

function renderProvinceHotspotList(container, items) {
  if (!container) return;
  container.innerHTML = items
    .map(
      (item) => `
        <button class="province-unit-item" type="button" data-orders-jump="${item.ordersJump ?? 'province-rank'}" data-orders-value="${item.ordersValue ?? item.unit}" aria-label="${item.ariaLabel ?? `查看${item.unit}关联案件`}">
          <span class="province-unit-item__head">
            <span class="province-unit-item__name">${item.unit}</span>
            <span class="province-unit-item__count">${item.count}</span>
          </span>
          <span class="province-unit-item__issue">${item.issue}</span>
          <span class="province-unit-item__meta">
            <span class="province-unit-item__ratio">${item.ratio}</span>
            <span class="province-unit-item__note">${item.note}</span>
          </span>
        </button>
      `
    )
    .join('');
}

function renderComboTrendChart(container, bars, line, labels) {
  if (!container) return;
  const width = container.clientWidth || 520;
  const height = container.clientHeight || 240;
  const chartHeight = height - 34;
  const baselineY = height - 24;
  const maxBar = Math.max(...bars, 1);
  const maxLine = Math.max(...line, 1);
  const stepX = (width - 24) / Math.max(labels.length - 1, 1);
  const barWidth = Math.min(24, stepX * 0.46);
  const linePoints = line.map((value, index) => {
    const x = 12 + index * stepX;
    const y = baselineY - (value / maxLine) * (chartHeight - 18);
    return { x, y, value };
  });
  const linePath = linePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const barsMarkup = bars
    .map((value, index) => {
      const x = 12 + index * stepX - barWidth / 2;
      const barHeight = (value / maxBar) * (chartHeight - 12);
      const y = baselineY - barHeight;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="4" fill="rgba(88, 183, 255, 0.72)" stroke="rgba(152, 226, 255, 0.24)" stroke-width="1"></rect>`;
    })
    .join('');
  const dotsMarkup = linePoints
    .map((point) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3" fill="#4de0d4"></circle>`)
    .join('');
  const labelsMarkup = labels
    .map((label, index) => {
      const x = 12 + index * stepX;
      return `<text x="${x.toFixed(2)}" y="${height - 6}" fill="rgba(152,188,208,0.72)" font-size="10" text-anchor="middle">${label}</text>`;
    })
    .join('');
  const triggerMarkup = labels
    .map((label, index) => {
      const barX = 12 + index * stepX - barWidth / 2;
      const barHeight = (bars[index] / maxBar) * (chartHeight - 12);
      const barY = baselineY - barHeight;
      const point = linePoints[index];
      return `
        <button class="province-combo-chart__bar-trigger" type="button" data-orders-jump="province-trend" data-orders-value="${label}" aria-label="查看${label}热点趋势关联案件" style="left:${(barX / width) * 100}%;width:${(barWidth / width) * 100}%;top:${(barY / height) * 100}%;height:${((baselineY - barY) / height) * 100}%"></button>
        <button class="province-combo-chart__dot-trigger" type="button" data-orders-jump="province-trend" data-orders-value="${label}" aria-label="查看${label}环比趋势关联案件" style="left:${(point.x / width) * 100}%;top:${(point.y / height) * 100}%"></button>
      `;
    })
    .join('');
  container.innerHTML = `
    <div class="province-combo-chart">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="province-bar-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(100, 205, 255, 0.9)" />
            <stop offset="100%" stop-color="rgba(28, 92, 164, 0.24)" />
          </linearGradient>
        </defs>
        <line x1="0" x2="${width}" y1="${baselineY}" y2="${baselineY}" stroke="var(--dt-chart-line-dim)" stroke-width="1"></line>
        ${barsMarkup.replaceAll('rgba(88, 183, 255, 0.72)', 'url(#province-bar-fill)')}
        <path d="${linePath}" fill="none" stroke="#4de0d4" stroke-width="2.4"></path>
        ${dotsMarkup}
        ${labelsMarkup}
      </svg>
      <div class="province-combo-chart__trigger-layer">${triggerMarkup}</div>
    </div>
  `;
}

function renderProvinceWarningCards() {
  const provinceData = BUSINESS_DATA.provinceWarning;
  const workorderStats = document.querySelector('[data-province-workorder-stats]');
  const monitorStats = document.querySelector('[data-province-monitor-stats]');
  const regionChart = document.querySelector('[data-province-region-chart]');
  const typeChart = document.querySelector('[data-province-type-chart]');
  const governanceChart = document.querySelector('[data-province-governance-chart]');
  const unitHotspots = document.querySelector('[data-province-unit-hotspots]');
  const trendChart = document.querySelector('[data-province-trend-chart]');
  const problemRank = document.querySelector('[data-province-problem-rank]');

  renderStatGrid(
    workorderStats,
    buildProvinceWorkorderStats(
      provinceData.workorderOverview.acceptanceStats,
      provinceData.workorderOverview.handlingStats
    )
  );
  renderStatGrid(
    monitorStats,
    provinceData.monitorStats.map((item) => ({
      ...item,
      triggerSource: 'province-closure',
      ariaLabel: `打开${item.label}关联案件列表`,
    }))
  );
  renderProvinceSharedAxisBarChart(
    regionChart,
    provinceData.regionDistribution.map((item) => ({
      ...item,
      triggerSource: 'province-hotrank-item',
      triggerArea: item.label,
      ariaLabel: `查看${item.label}区域关联案件`,
    }))
  );
  renderFanDistributionChart(
    typeChart,
    provinceData.orderTypeDistribution.map((item) => ({
      ...item,
      ordersJump: 'province-type',
      ordersValue: item.label,
      ariaLabel: `查看${item.label}类型关联案件`,
    }))
  );
  renderFanDistributionChart(
    governanceChart,
    provinceData.governanceShare.map((item) => ({
      ...item,
      ordersJump: 'province-topic',
      ordersValue: item.label,
      ariaLabel: `查看${item.label}治理热点关联案件`,
    }))
  );
  renderProvinceHotspotList(
    unitHotspots,
    provinceData.handlingUnitHotspots.map((item) => ({
      ...item,
      ordersJump: 'province-rank',
      ordersValue: item.unit,
      ariaLabel: `查看${item.unit}承办关联案件`,
    }))
  );
  renderComboTrendChart(trendChart, provinceData.provinceTrend.bars, provinceData.provinceTrend.line, provinceData.provinceTrend.labels);
  renderHorizontalRankChart(
    problemRank,
    provinceData.problemRanking.map((item) => ({
      ...item,
      ordersJump: 'province-issue',
      ordersValue: item.label,
      ariaLabel: `查看${item.label}热点问题关联案件`,
    }))
  );
  animateCounts(document.querySelector('[data-topic-content="province-warning"]') ?? document);
}

function renderOrdersWorkbench(topic = getActiveCityTopic()) {
  const root = getScopedTopicElement(topic, '[data-orders-workbench]');
  const overview = getScopedTopicElement(topic, '[data-orders-overview]');
  const channelChart = getScopedTopicElement(topic, '[data-orders-channel-chart]');
  const typeChart = getScopedTopicElement(topic, '[data-orders-type-chart]');
  const trendChart = getScopedTopicElement(topic, '[data-orders-trend-chart]');
  const rankChart = getScopedTopicElement(topic, '[data-orders-rank-chart]');
  if (!root || !overview || !channelChart || !typeChart || !trendChart || !rankChart) return;

  const state = getOrdersWorkbenchState(topic);
  root.dataset.ordersWorkbenchState = state.isOpen ? 'open' : 'closed';
  overview.innerHTML = BUSINESS_DATA.ordersWorkbench.overview
    .map(
      (item) => `
        <button class="map-orders-overview__trigger" type="button" data-orders-jump="overview" data-orders-value="orders" aria-label="查看${item.label}关联案件">
          <article class="biz-stat">
            <span class="biz-stat__label">${item.label}</span>
            <div class="biz-panel__value-row">
              <span class="biz-stat__value" data-count-to="${item.value}" data-count-format="${item.format ?? 'integer'}">0</span>
              <span class="biz-stat__unit">${item.unit ?? ''}</span>
            </div>
            ${item.delta ? `<span class="biz-stat__delta biz-stat__delta--${item.deltaClass ?? 'up'}">${item.delta}</span>` : ''}
          </article>
        </button>
      `
    )
    .join('');
  renderVerticalBarChart(channelChart, BUSINESS_DATA.ordersWorkbench.channels, 'channel');
  renderVerticalBarChart(typeChart, BUSINESS_DATA.ordersWorkbench.types, 'type');
  renderOrdersTrendChart(trendChart, BUSINESS_DATA.ordersWorkbench.trend, BUSINESS_DATA.ordersWorkbench.trendLabels);
  renderHorizontalRankChart(rankChart, BUSINESS_DATA.ordersWorkbench.ranking);
}

function openOrdersWorkbench(topic = getActiveCityTopic()) {
  getOrdersWorkbenchState(topic).isOpen = true;
  renderOrdersWorkbench(topic);
}

function closeOrdersWorkbench(topic = getActiveCityTopic()) {
  getOrdersWorkbenchState(topic).isOpen = false;
  renderOrdersWorkbench(topic);
}

function getWorkbenchLevelIcon(level) {
  if (level === 'high') return '!';
  if (level === 'medium') return '•';
  return '·';
}

function renderWorkbenchList(container, dataset) {
  const startIndex = (WORKBENCH_STATE.page - 1) * WORKBENCH_STATE.pageSize;
  const pageItems = dataset.items.slice(startIndex, startIndex + WORKBENCH_STATE.pageSize);

  container.innerHTML = pageItems
    .map(
      (item) => `
        <article class="map-workbench__item map-workbench__item--${item.level}" data-detail-trigger="${item.id}" role="button" tabindex="0" aria-label="打开${item.title}工单详情">
          <div class="map-workbench__item-icon" aria-hidden="true">
            <span class="map-workbench__item-icon-core">${getWorkbenchLevelIcon(item.level)}</span>
          </div>
          <div class="map-workbench__item-main">
            <div class="map-workbench__item-title">${item.title}</div>
            <div class="map-workbench__item-meta">
              <span>${item.dept}</span>
              <span>${item.type}</span>
            </div>
            <div class="map-workbench__item-meta">
              <span>${item.area}</span>
              <span>${item.source}</span>
            </div>
            <div class="map-workbench__item-time">
              <span>${item.time}</span>
              <span>${item.elapsed}</span>
            </div>
          </div>
          <div class="map-workbench__item-side">
            <span class="map-workbench__status map-workbench__status--${item.statusTone}">${item.status}</span>
          </div>
        </article>
      `
    )
    .join('');
}

function renderWorkbenchPagination(container, totalPages) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .map(
      (page) => `
        <button class="map-workbench__page${page === WORKBENCH_STATE.page ? ' map-workbench__page--active' : ''}" type="button" data-workbench-page="${page}">${page}</button>
      `
    )
    .join('');

  container.innerHTML = `
    <button class="map-workbench__page map-workbench__page--nav" type="button" data-workbench-page-nav="prev" ${WORKBENCH_STATE.page === 1 ? 'disabled' : ''}>上一页</button>
    <div class="map-workbench__page-list">${pages}</div>
    <button class="map-workbench__page map-workbench__page--nav" type="button" data-workbench-page-nav="next" ${WORKBENCH_STATE.page === totalPages ? 'disabled' : ''}>下一页</button>
  `;
}

function buildDetailFromItem(item) {
  return item.detail ?? {
    nature: item.type,
    category: item.type,
    subCategory: `${item.type}处置`,
    code: `GD-${item.id.toUpperCase()}`,
    caseStatus: item.status,
    source: item.source,
    complainedParty: item.area,
    responsibleParty: item.dept,
    reportTime: `2026-05-28 ${item.time}`,
    location: item.area,
    address: `${item.area} 重点处置点位`,
    description: `${item.title}，当前状态为${item.status}，系统持续跟踪并更新处置进度。`,
    images: ['现场画面 01', '现场画面 02', '处置留痕 03', '回传影像 04'],
  };
}

function getWorkbenchItems() {
  return getWorkbenchDataset().items;
}

function getCurrentDetailItem() {
  return getWorkbenchItems().find((item) => item.id === DETAIL_WORKBENCH_STATE.itemId) ?? null;
}

function renderDetailWorkbench() {
  const root = document.querySelector('[data-detail-workbench]');
  const title = document.querySelector('[data-detail-title]');
  const grid = document.querySelector('[data-detail-grid]');
  const images = document.querySelector('[data-detail-images]');
  if (!root || !title || !grid || !images) return;

  const item = getCurrentDetailItem();
  root.dataset.detailWorkbenchState = DETAIL_WORKBENCH_STATE.isOpen ? 'open' : 'closed';
  if (!item) {
    title.textContent = '案件信息';
    grid.innerHTML = '';
    images.innerHTML = '';
    return;
  }

  const detail = buildDetailFromItem(item);
  title.textContent = item.title;

  const fields = [
    ['工单性质', detail.nature],
    ['问题大类', detail.category],
    ['问题小类', detail.subCategory],
    ['案件编号', detail.code],
    ['案件状态', detail.caseStatus],
    ['案件来源', detail.source],
    ['被诉主体', detail.complainedParty],
    ['责任主体', detail.responsibleParty],
    ['上报时间', detail.reportTime],
    ['事件位置', detail.location],
    ['地址描述', detail.address],
    ['问题描述', detail.description],
  ];

  grid.innerHTML = fields
    .map(
      ([label, value]) => `
        <div class="map-detail-workbench__field${label === '问题描述' ? ' map-detail-workbench__field--full' : ''}">
          <span class="map-detail-workbench__field-label">${label}</span>
          <span class="map-detail-workbench__field-value">${value}</span>
        </div>
      `
    )
    .join('');

  images.innerHTML = detail.images
    .map(
      (name, index) => `
        <article class="map-detail-workbench__image-card">
          <div class="map-detail-workbench__image-scan" aria-hidden="true"></div>
          <div class="map-detail-workbench__image-core">
            <span class="map-detail-workbench__image-badge">IMG ${String(index + 1).padStart(2, '0')}</span>
            <span class="map-detail-workbench__image-name">${name}</span>
          </div>
        </article>
      `
    )
    .join('');
}

function openDetailWorkbench(itemId) {
  DETAIL_WORKBENCH_STATE.isOpen = true;
  DETAIL_WORKBENCH_STATE.itemId = itemId;
  renderDetailWorkbench();
}

function closeDetailWorkbench() {
  DETAIL_WORKBENCH_STATE.isOpen = false;
  renderDetailWorkbench();
}

function renderWorkbench() {
  const root = document.querySelector('[data-workbench]');
  const summary = document.querySelector('[data-workbench-summary]');
  const list = document.querySelector('[data-workbench-list]');
  const pagination = document.querySelector('[data-workbench-pagination]');
  const sourceLabel = document.querySelector('[data-workbench-source-label]');
  if (!root || !summary || !list || !pagination || !sourceLabel) return;

  const dataset = getWorkbenchDataset();
  const totalPages = Math.max(Math.ceil(dataset.items.length / WORKBENCH_STATE.pageSize), 1);
  if (WORKBENCH_STATE.page > totalPages) WORKBENCH_STATE.page = totalPages;

  root.dataset.workbenchState = WORKBENCH_STATE.isOpen ? 'open' : 'closed';
  sourceLabel.textContent = WORKBENCH_STATE.area
    ? `${WORKBENCH_SOURCE_LABELS[WORKBENCH_STATE.source]} · ${WORKBENCH_STATE.area}`
    : WORKBENCH_SOURCE_LABELS[WORKBENCH_STATE.source];

  renderWorkbenchSummary(summary, dataset);
  renderWorkbenchList(list, dataset);
  renderWorkbenchPagination(pagination, totalPages);
  renderDetailWorkbench();
}

function openWorkbench(triggerSource, area = '') {
  const source = WORKBENCH_SOURCE_MAP[triggerSource];
  if (!source) return;
  WORKBENCH_STATE.isOpen = true;
  WORKBENCH_STATE.source = source;
  WORKBENCH_STATE.page = 1;
  WORKBENCH_STATE.area = area || '';
  WORKBENCH_STATE.filterType = '';
  WORKBENCH_STATE.filterSource = '';
  WORKBENCH_STATE.filterDept = '';
  WORKBENCH_STATE.filterTopic = '';
  WORKBENCH_STATE.filterIssue = '';
  renderWorkbench();
}

function openWorkbenchFromOrdersJump(kind, value) {
  // 诉求事件地图的热点事项使用专门的弹窗
  if (kind === 'appeal-hotitem') {
    openAppealDetailPanel(value);
    return;
  }

  WORKBENCH_STATE.isOpen = true;
  WORKBENCH_STATE.source = 'distribution';
  WORKBENCH_STATE.page = 1;
  WORKBENCH_STATE.area = '';
  WORKBENCH_STATE.filterType = '';
  WORKBENCH_STATE.filterSource = '';
  WORKBENCH_STATE.filterDept = '';
  WORKBENCH_STATE.filterTopic = '';
  WORKBENCH_STATE.filterIssue = '';

  if (kind === 'channel') {
    WORKBENCH_STATE.filterSource = value;
  } else if (kind === 'type') {
    WORKBENCH_STATE.filterType = value;
  } else if (kind === 'rank') {
    WORKBENCH_STATE.source = 'hotrank';
    WORKBENCH_STATE.filterDept = value;
  } else if (kind === 'overview') {
    WORKBENCH_STATE.source = 'acceptanceRate';
  } else if (kind === 'province-type') {
    WORKBENCH_STATE.source = 'provinceDistribution';
    WORKBENCH_STATE.filterType = value;
  } else if (kind === 'province-rank') {
    WORKBENCH_STATE.source = 'provinceHotrank';
    WORKBENCH_STATE.filterDept = value;
  } else if (kind === 'province-topic') {
    WORKBENCH_STATE.source = 'provinceGovernance';
    WORKBENCH_STATE.filterTopic = value;
  } else if (kind === 'province-issue') {
    WORKBENCH_STATE.source = 'provinceProblem';
    WORKBENCH_STATE.filterIssue = value;
  } else if (kind === 'province-trend') {
    WORKBENCH_STATE.source = 'provinceTrend';
  }

  renderWorkbench();
}

// 诉求事项详情弹窗状态
const APPEAL_DETAIL_STATE = {
  isOpen: false,
  itemName: '',
  value: 0,
  ratio: 0,
};

const SPECIAL_ANALYSIS_PANEL_STATE = {
  isOpen: false,
};

const SPECIAL_ANALYSIS_DETAIL_STATE = {
  isOpen: false,
  itemName: '',
  value: 0,
  ratio: 0,
  areaLevel: 'district',
  activeDistrict: '',
};

const BOTTLENECK_PANEL_STATE = {
  isOpen: false,
  type: '',
  activeDept: '',
};

const SPECIAL_ANALYSIS_ORDERS_STATE = {
  isOpen: false,
  metric: '',
  activeDept: '',
  activeUnit: '',
  activeFocus: '',
};

const SPECIAL_ANALYSIS_TICKET_STATE = {
  isOpen: false,
  category: '',
};

const SPECIAL_ANALYSIS_TICKET_DETAIL_STATE = {
  isOpen: false,
  itemId: '',
};


function openAppealDetailPanel(itemName) {
  APPEAL_DETAIL_STATE.isOpen = true;
  APPEAL_DETAIL_STATE.itemName = itemName;

  // 从数据中查找对应事项
  const allItems = [
    ...BUSINESS_DATA.appealHotItem.level1,
    ...BUSINESS_DATA.appealHotItem.level2,
    ...BUSINESS_DATA.appealHotItem.level3,
  ];
  const item = allItems.find((i) => i.label === itemName);
  if (item) {
    APPEAL_DETAIL_STATE.value = item.value;
    APPEAL_DETAIL_STATE.ratio = item.ratio ?? 0;
  }

  renderAppealDetailPanel();
}

function closeAppealDetailPanel() {
  APPEAL_DETAIL_STATE.isOpen = false;
  renderAppealDetailPanel();
}

function openSpecialAnalysisPanel() {
  SPECIAL_ANALYSIS_PANEL_STATE.isOpen = true;
  renderSpecialAnalysisPanel();
}

function closeSpecialAnalysisPanel() {
  SPECIAL_ANALYSIS_PANEL_STATE.isOpen = false;
  renderSpecialAnalysisPanel();
}

function openSpecialAnalysisDetailPanel(itemName) {
  SPECIAL_ANALYSIS_DETAIL_STATE.isOpen = true;
  SPECIAL_ANALYSIS_DETAIL_STATE.itemName = itemName;
  SPECIAL_ANALYSIS_DETAIL_STATE.areaLevel = 'district';
  SPECIAL_ANALYSIS_DETAIL_STATE.activeDistrict = '';
  const items = [
    { label: '校园周边占道经营', value: 1286, ratio: 12 },
    { label: '夜间施工噪声扰民', value: 1042, ratio: -6 },
    { label: '老旧小区停车矛盾', value: 896, ratio: 9 },
    { label: '沿街商铺油烟投诉', value: 774, ratio: -4 },
    { label: '住宅区充电安全隐患', value: 683, ratio: 15 },
    { label: '城中村环境卫生反复投诉', value: 642, ratio: 7 },
    { label: '商业街消防通道堵塞', value: 598, ratio: -3 },
    { label: '学校周边交通秩序整治', value: 544, ratio: 11 },
    { label: '餐饮集中区油烟异味', value: 503, ratio: 5 },
    { label: '老旧社区照明故障投诉', value: 468, ratio: -2 },
  ];
  const item = items.find((entry) => entry.label === itemName);
  if (item) {
    SPECIAL_ANALYSIS_DETAIL_STATE.value = item.value;
    SPECIAL_ANALYSIS_DETAIL_STATE.ratio = item.ratio;
  }
  renderSpecialAnalysisDetailPanel();
}

function closeSpecialAnalysisDetailPanel() {
  SPECIAL_ANALYSIS_DETAIL_STATE.isOpen = false;
  renderSpecialAnalysisDetailPanel();
}

function openBottleneckPanel(type) {
  BOTTLENECK_PANEL_STATE.isOpen = true;
  BOTTLENECK_PANEL_STATE.type = type;
  BOTTLENECK_PANEL_STATE.activeDept = '';
  renderBottleneckPanel();
}

function closeBottleneckPanel() {
  BOTTLENECK_PANEL_STATE.isOpen = false;
  renderBottleneckPanel();
}

function openSpecialAnalysisOrdersPanel(metric, activeUnit = '', activeFocus = '') {
  SPECIAL_ANALYSIS_ORDERS_STATE.isOpen = true;
  SPECIAL_ANALYSIS_ORDERS_STATE.metric = metric;
  SPECIAL_ANALYSIS_ORDERS_STATE.activeDept = '';
  SPECIAL_ANALYSIS_ORDERS_STATE.activeUnit = activeUnit;
  SPECIAL_ANALYSIS_ORDERS_STATE.activeFocus = activeFocus;
  renderSpecialAnalysisOrdersPanel();
}

function closeSpecialAnalysisOrdersPanel() {
  SPECIAL_ANALYSIS_ORDERS_STATE.isOpen = false;
  SPECIAL_ANALYSIS_ORDERS_STATE.activeUnit = '';
  SPECIAL_ANALYSIS_ORDERS_STATE.activeFocus = '';
  renderSpecialAnalysisOrdersPanel();
}

function getSpecialAnalysisOrdersPanelConfig() {
  const activeUnit = SPECIAL_ANALYSIS_ORDERS_STATE.activeUnit || '';
  const metric = SPECIAL_ANALYSIS_ORDERS_STATE.metric;
  const activeKpiKey = SPECIAL_ANALYSIS_ORDERS_STATE.activeFocus || '';
  const activeKpiRanking = SPECIAL_ANALYSIS_KPI_RANKING_DATA[activeKpiKey] ?? null;

  const config = {
    'total-orders': {
      layout: 'summary',
      subtitle: '总工单量',
      regions: [
        { label: '天河区', value: 3486 },
        { label: '越秀区', value: 3184 },
        { label: '海珠区', value: 2868 },
        { label: '番禺区', value: 2526 },
        { label: '白云区', value: 2312 },
      ],
      top10: [
        { label: '天河区', value: 3486, color: '#57b8ff' },
        { label: '越秀区', value: 3184, color: '#4de0d4' },
        { label: '海珠区', value: 2868, color: '#8b9bff' },
        { label: '番禺区', value: 2526, color: '#ffb561' },
        { label: '白云区', value: 2312, color: '#73d5ff' },
        { label: '黄埔区', value: 2148, color: '#7ca8ff' },
        { label: '荔湾区', value: 1986, color: '#57b8ff' },
        { label: '南山区', value: 1862, color: '#4de0d4' },
        { label: '福田区', value: 1728, color: '#8b9bff' },
        { label: '宝安区', value: 1604, color: '#ffb561' },
      ],
    },
    'avg-duration': {
      layout: 'summary',
      subtitle: '平均时长',
      regions: [
        { label: '白云区', value: 26.4 },
        { label: '番禺区', value: 24.8 },
        { label: '海珠区', value: 22.6 },
        { label: '越秀区', value: 20.3 },
        { label: '天河区', value: 18.6 },
      ],
      top10: [
        { label: '白云区', value: 264, color: '#57b8ff' },
        { label: '番禺区', value: 248, color: '#4de0d4' },
        { label: '海珠区', value: 226, color: '#8b9bff' },
        { label: '越秀区', value: 203, color: '#ffb561' },
        { label: '天河区', value: 186, color: '#73d5ff' },
        { label: '黄埔区', value: 178, color: '#7ca8ff' },
        { label: '南山区', value: 171, color: '#57b8ff' },
        { label: '宝安区', value: 166, color: '#4de0d4' },
        { label: '福田区', value: 159, color: '#8b9bff' },
        { label: '荔湾区', value: 152, color: '#ffb561' },
      ],
    },
    'change-rate': {
      layout: 'summary',
      subtitle: '环比变化',
      regions: [
        { label: '南山区', value: 32 },
        { label: '天河区', value: 28 },
        { label: '海珠区', value: 24 },
        { label: '越秀区', value: 21 },
        { label: '番禺区', value: 18 },
      ],
      top10: [
        { label: '南山区', value: 320, color: '#57b8ff' },
        { label: '天河区', value: 280, color: '#4de0d4' },
        { label: '海珠区', value: 240, color: '#8b9bff' },
        { label: '越秀区', value: 210, color: '#ffb561' },
        { label: '番禺区', value: 180, color: '#73d5ff' },
        { label: '白云区', value: 162, color: '#7ca8ff' },
        { label: '黄埔区', value: 148, color: '#57b8ff' },
        { label: '福田区', value: 136, color: '#4de0d4' },
        { label: '宝安区', value: 122, color: '#8b9bff' },
        { label: '荔湾区', value: 108, color: '#ffb561' },
      ],
    },
    'in-transit': {
      layout: 'in-transit',
      subtitle: '在途工单',
      depts: [
        {
          name: '天河区政务服务中心',
          count: 628,
          trend: [482, 508, 536, 552, 588, 614],
          warnings: [
            '石牌街道噪声扰民工单超24小时未办结',
            '员村片区道路积水工单连续预警',
            '珠江新城商圈油烟投诉重复流转',
          ],
        },
        {
          name: '越秀区城运中心',
          count: 574,
          trend: [438, 452, 476, 501, 536, 574],
          warnings: [
            '北京街道施工噪声工单待现场核查',
            '东山街道消防通道堵塞工单超时',
            '洪桥街道占道经营工单二次退回',
          ],
        },
        {
          name: '海珠区综合治理办',
          count: 521,
          trend: [396, 418, 437, 463, 492, 521],
          warnings: [
            '新港街道道路积水工单办理进度滞后',
            '江南中街道油烟扰民工单重复上报',
            '赤岗街道夜间施工工单待签收',
          ],
        },
        {
          name: '番禺区街面治理专班',
          count: 486,
          trend: [362, 388, 406, 432, 458, 486],
          warnings: [
            '市桥街道占道经营工单超时预警',
            '南村镇停车矛盾工单待部门联办',
            '大石街道商业街秩序工单重复退回',
          ],
        },
        {
          name: '白云区热线联动中心',
          count: 452,
          trend: [338, 352, 374, 398, 421, 452],
          warnings: [
            '同和街道噪声扰民工单处置超时',
            '嘉禾街道充电安全隐患工单待复核',
            '棠景街道油烟投诉工单重复预警',
          ],
        },
      ],
    },
    'kpi-unit-ranking': {
      layout: 'kpi-unit-ranking',
      subtitle: activeKpiRanking?.subtitle ?? '单位排名',
      top5: activeKpiRanking?.top5 ?? [],
      bottom5: activeKpiRanking?.bottom5 ?? [],
    },
    'orders-more': {
      layout: 'orders-more',
      subtitle: '更多',
      undertakingTop5: [
        { label: '天河区政务服务中心', value: 1286, meta: '环比变化量 +84' },
        { label: '越秀区城运中心', value: 1124, meta: '环比变化量 +63' },
        { label: '南山区综合治理办', value: 986, meta: '环比变化量 +51' },
        { label: '番禺区街面治理专班', value: 874, meta: '环比变化量 +38' },
        { label: '宝安区热线联动中心', value: 816, meta: '环比变化量 +26' },
      ],
      handlingTop5: [
        { label: '天河区政务服务中心', value: 1198, meta: '环比变化量 +76' },
        { label: '越秀区城运中心', value: 1086, meta: '环比变化量 +58' },
        { label: '南山区综合治理办', value: 952, meta: '环比变化量 +46' },
        { label: '番禺区街面治理专班', value: 836, meta: '环比变化量 +35' },
        { label: '宝安区热线联动中心', value: 788, meta: '环比变化量 +22' },
      ],
    },
    'unit-dispatch': {
      layout: 'unit-dispatch',
      subtitle: '交办单分析',
      focusTop5: [
        {
          label: '夜间施工噪声扰民',
          trend: [62, 74, 88, 96, 108, 126],
          types: [
            { label: '投诉', value: 46 },
            { label: '求助', value: 28 },
            { label: '举报', value: 24 },
            { label: '咨询', value: 18 },
            { label: '其他', value: 10 },
          ],
          areas: [
            { label: '天河区', value: 86 },
            { label: '越秀区', value: 78 },
            { label: '海珠区', value: 69 },
            { label: '番禺区', value: 58 },
            { label: '白云区', value: 46 },
          ],
          closures: [
            { label: '石牌街道办', value: 42, color: '#57b8ff' },
            { label: '北京街道办', value: 38, color: '#4de0d4' },
            { label: '新港街道办', value: 33, color: '#8b9bff' },
            { label: '市桥街道办', value: 28, color: '#ffb561' },
            { label: '同和街道办', value: 24, color: '#73d5ff' },
          ],
        },
        {
          label: '校园周边占道经营',
          trend: [58, 68, 82, 91, 102, 114],
          types: [
            { label: '投诉', value: 42 },
            { label: '举报', value: 30 },
            { label: '求助', value: 22 },
            { label: '咨询', value: 12 },
            { label: '其他', value: 8 },
          ],
          areas: [
            { label: '天河区', value: 82 },
            { label: '番禺区', value: 74 },
            { label: '越秀区', value: 66 },
            { label: '海珠区', value: 54 },
            { label: '白云区', value: 41 },
          ],
          closures: [
            { label: '石牌街道办', value: 39, color: '#57b8ff' },
            { label: '南村镇街道办', value: 35, color: '#4de0d4' },
            { label: '北京街道办', value: 30, color: '#8b9bff' },
            { label: '赤岗街道办', value: 26, color: '#ffb561' },
            { label: '嘉禾街道办', value: 22, color: '#73d5ff' },
          ],
        },
        {
          label: '沿街商铺油烟投诉',
          trend: [52, 63, 76, 84, 92, 96],
          types: [
            { label: '投诉', value: 44 },
            { label: '举报', value: 26 },
            { label: '求助', value: 14 },
            { label: '咨询', value: 8 },
            { label: '其他', value: 4 },
          ],
          areas: [
            { label: '海珠区', value: 74 },
            { label: '越秀区', value: 68 },
            { label: '白云区', value: 59 },
            { label: '天河区', value: 51 },
            { label: '番禺区', value: 43 },
          ],
          closures: [
            { label: '江南中街道办', value: 34, color: '#57b8ff' },
            { label: '北京街道办', value: 31, color: '#4de0d4' },
            { label: '棠景街道办', value: 27, color: '#8b9bff' },
            { label: '石牌街道办', value: 24, color: '#ffb561' },
            { label: '大石街道办', value: 21, color: '#73d5ff' },
          ],
        },
        {
          label: '商业街消防通道堵塞',
          trend: [46, 55, 63, 71, 77, 82],
          types: [
            { label: '举报', value: 34 },
            { label: '投诉', value: 24 },
            { label: '求助', value: 12 },
            { label: '咨询', value: 7 },
            { label: '其他', value: 5 },
          ],
          areas: [
            { label: '南山区', value: 68 },
            { label: '天河区', value: 61 },
            { label: '越秀区', value: 52 },
            { label: '海珠区', value: 44 },
            { label: '白云区', value: 38 },
          ],
          closures: [
            { label: '珠江街道办', value: 29, color: '#57b8ff' },
            { label: '石牌街道办', value: 26, color: '#4de0d4' },
            { label: '东山街道办', value: 23, color: '#8b9bff' },
            { label: '赤岗街道办', value: 20, color: '#ffb561' },
            { label: '同和街道办', value: 17, color: '#73d5ff' },
          ],
        },
        {
          label: '老旧小区停车矛盾',
          trend: [42, 51, 60, 67, 71, 74],
          types: [
            { label: '投诉', value: 28 },
            { label: '求助', value: 20 },
            { label: '咨询', value: 14 },
            { label: '举报', value: 7 },
            { label: '其他', value: 5 },
          ],
          areas: [
            { label: '番禺区', value: 63 },
            { label: '天河区', value: 56 },
            { label: '海珠区', value: 48 },
            { label: '越秀区', value: 41 },
            { label: '白云区', value: 35 },
          ],
          closures: [
            { label: '市桥街道办', value: 27, color: '#57b8ff' },
            { label: '石牌街道办', value: 24, color: '#4de0d4' },
            { label: '新港街道办', value: 21, color: '#8b9bff' },
            { label: '北京街道办', value: 18, color: '#ffb561' },
            { label: '同和街道办', value: 15, color: '#73d5ff' },
          ],
        },
      ],
    },
    'warning-group-issue-count': {
      layout: 'governance-warning-detail',
      subtitle: '群发事项监测数量',
      groupIssues: [
        { label: '夜间施工噪声扰民', value: 132 },
        { label: '校园周边占道经营', value: 118 },
        { label: '沿街商铺油烟投诉', value: 104 },
        { label: '商业街消防通道堵塞', value: 92 },
        { label: '学校周边交通秩序整治', value: 86 },
      ],
      frequentIssues: [
        { label: '道路积水重复上报', value: 128 },
        { label: '老旧小区停车矛盾', value: 116 },
        { label: '商业综合体秩序问题', value: 98 },
        { label: '住宅区充电安全隐患', value: 84 },
        { label: '餐饮集中区油烟异味', value: 72 },
      ],
      chaosAreas: [
        { label: '石牌街道办', value: 96 },
        { label: '北京街道办', value: 84 },
        { label: '新港街道办', value: 78 },
        { label: '同和街道办', value: 66 },
        { label: '嘉禾街道办', value: 58 },
      ],
      trend: [84, 92, 106, 118, 126, 132],
      tickets: [
        { id: 'gw-ticket-1', title: `${activeUnit} 夜间施工噪声扰民事项集中上升`, status: '重点督办', time: '08:50', unit: activeUnit || '天河区城管局', process: '受理 → 派单 → 办理中', currentTime: '2026-06-01 14:20', content: '商圈周边夜间施工投诉量连续上升。', result: '已派发属地街道核查并启动联合处置。', handler: activeUnit || '天河区城管局' },
        { id: 'gw-ticket-2', title: `${activeUnit} 校园周边占道经营反复出现`, status: '持续关注', time: '09:12', unit: activeUnit || '天河区城管局', process: '受理 → 签收 → 办理中', currentTime: '2026-06-01 14:20', content: '学校周边流动摊贩高峰时段聚集明显。', result: '城管执法队已安排错峰巡查。', handler: activeUnit || '天河区城管局' },
        { id: 'gw-ticket-3', title: `${activeUnit} 沿街商铺油烟投诉多发`, status: '办理中', time: '10:05', unit: activeUnit || '天河区城管局', process: '受理 → 派单 → 核查', currentTime: '2026-06-01 14:20', content: '重点餐饮街区油烟扰民事项重复上报。', result: '生态环境分局与街道办联合复核中。', handler: activeUnit || '天河区城管局' },
      ],
    },
    'warning-frequent-issue-count': {
      layout: 'governance-warning-detail',
      subtitle: '多发事项监测数量',
      groupIssues: [
        { label: '噪声扰民', value: 126 },
        { label: '道路积水', value: 108 },
        { label: '停车矛盾', value: 94 },
        { label: '油烟异味', value: 82 },
        { label: '消防隐患', value: 70 },
      ],
      frequentIssues: [
        { label: '夜间施工噪声扰民', value: 138 },
        { label: '老旧小区停车矛盾', value: 122 },
        { label: '沿街商铺油烟投诉', value: 110 },
        { label: '城中村环境卫生反复投诉', value: 91 },
        { label: '高层住宅电梯故障', value: 76 },
      ],
      chaosAreas: [
        { label: '员村街道办', value: 88 },
        { label: '东山街道办', value: 79 },
        { label: '江南中街道办', value: 70 },
        { label: '南村镇街道办', value: 63 },
        { label: '棠景街道办', value: 55 },
      ],
      trend: [72, 80, 95, 108, 118, 138],
      tickets: [
        { id: 'gw-ticket-4', title: `${activeUnit} 夜间施工噪声扰民事项高频出现`, status: '重点督办', time: '08:42', unit: activeUnit || '天河区城管局', process: '受理 → 派单 → 办理中', currentTime: '2026-06-01 14:20', content: '近一周夜间施工噪声类事项明显增多。', result: '已联动住建部门开展夜查。', handler: activeUnit || '天河区城管局' },
        { id: 'gw-ticket-5', title: `${activeUnit} 老旧小区停车矛盾重复流转`, status: '持续关注', time: '09:18', unit: activeUnit || '天河区城管局', process: '受理 → 协同 → 办理中', currentTime: '2026-06-01 14:20', content: '停车矛盾事项重复派单、重复投诉。', result: '街道办正在组织专题协调。', handler: activeUnit || '天河区城管局' },
        { id: 'gw-ticket-6', title: `${activeUnit} 沿街商铺油烟投诉频次升高`, status: '办理中', time: '10:08', unit: activeUnit || '天河区城管局', process: '受理 → 派单 → 核查', currentTime: '2026-06-01 14:20', content: '餐饮密集区油烟问题高频上报。', result: '相关商户正在复检整改。', handler: activeUnit || '天河区城管局' },
      ],
    },
    'warning-chaos-area-count': {
      layout: 'governance-warning-detail',
      subtitle: '乱点区域监测数量',
      groupIssues: [
        { label: '商圈噪声扰民', value: 102 },
        { label: '校园周边秩序', value: 96 },
        { label: '餐饮油烟异味', value: 88 },
        { label: '道路积水反复', value: 74 },
        { label: '消防通道堵塞', value: 68 },
      ],
      frequentIssues: [
        { label: '老旧小区停车矛盾', value: 112 },
        { label: '商业综合体秩序问题', value: 98 },
        { label: '沿街商铺油烟投诉', value: 90 },
        { label: '住宅区充电安全隐患', value: 80 },
        { label: '夜间施工噪声扰民', value: 72 },
      ],
      chaosAreas: [
        { label: '珠江街道办', value: 86 },
        { label: '洪桥街道办', value: 78 },
        { label: '赤岗街道办', value: 69 },
        { label: '大石街道办', value: 61 },
        { label: '同和街道办', value: 53 },
      ],
      trend: [64, 70, 76, 82, 84, 86],
      tickets: [
        { id: 'gw-ticket-7', title: `${activeUnit} 商圈周边乱点区域持续活跃`, status: '重点督办', time: '08:36', unit: activeUnit || '天河区城管局', process: '受理 → 派单 → 办理中', currentTime: '2026-06-01 14:20', content: '重点商圈周边市容秩序问题重复出现。', result: '已组织城管和街道开展联动整治。', handler: activeUnit || '天河区城管局' },
        { id: 'gw-ticket-8', title: `${activeUnit} 餐饮集中区乱点问题抬升`, status: '持续关注', time: '09:26', unit: activeUnit || '天河区城管局', process: '受理 → 协同 → 办理中', currentTime: '2026-06-01 14:20', content: '油烟、占道经营等问题在局部片区聚集。', result: '属地街道正在连续巡查。', handler: activeUnit || '天河区城管局' },
        { id: 'gw-ticket-9', title: `${activeUnit} 社区周边停车乱点反复出现`, status: '办理中', time: '10:16', unit: activeUnit || '天河区城管局', process: '受理 → 派单 → 核查', currentTime: '2026-06-01 14:20', content: '部分老旧社区周边停车矛盾集中。', result: '已联合交警现场疏导。', handler: activeUnit || '天河区城管局' },
      ],
    },
    'warning-order-count': {
      layout: 'governance-warning-detail',
      subtitle: '工单件数',
      groupIssues: [
        { label: '夜间施工噪声扰民', value: 146 },
        { label: '道路积水重复上报', value: 132 },
        { label: '老旧小区停车矛盾', value: 118 },
        { label: '沿街商铺油烟投诉', value: 104 },
        { label: '商业街消防通道堵塞', value: 92 },
      ],
      frequentIssues: [
        { label: '校园周边占道经营', value: 138 },
        { label: '住宅区充电安全隐患', value: 120 },
        { label: '商业综合体秩序问题', value: 112 },
        { label: '餐饮集中区油烟异味', value: 96 },
        { label: '高层住宅电梯故障', value: 84 },
      ],
      chaosAreas: [
        { label: '石牌街道办', value: 102 },
        { label: '员村街道办', value: 93 },
        { label: '东山街道办', value: 82 },
        { label: '赤岗街道办', value: 74 },
        { label: '大石街道办', value: 66 },
      ],
      trend: [96, 108, 118, 126, 138, 146],
      tickets: [
        { id: 'gw-ticket-10', title: `${activeUnit} 总体工单量持续走高`, status: '重点督办', time: '08:28', unit: activeUnit || '天河区城管局', process: '受理 → 派单 → 办理中', currentTime: '2026-06-01 14:20', content: '治理要点相关工单总量连续上涨。', result: '已纳入专项监测清单。', handler: activeUnit || '天河区城管局' },
        { id: 'gw-ticket-11', title: `${activeUnit} 热点事项带动工单件数增加`, status: '持续关注', time: '09:14', unit: activeUnit || '天河区城管局', process: '受理 → 签收 → 办理中', currentTime: '2026-06-01 14:20', content: '多类热点事项并发导致工单量增加。', result: '已组织专班跟踪处置。', handler: activeUnit || '天河区城管局' },
        { id: 'gw-ticket-12', title: `${activeUnit} 区域乱点事项转化为批量工单`, status: '办理中', time: '10:02', unit: activeUnit || '天河区城管局', process: '受理 → 协同 → 核查', currentTime: '2026-06-01 14:20', content: '局部区域乱点问题转化为批量上报工单。', result: '已安排属地部门联动核查。', handler: activeUnit || '天河区城管局' },
      ],
    },
    'warning-change-rate': {
      layout: 'warning-detail',
      subtitle: '变化率异常',
      hotspotTop5: [
        { label: '夜间施工噪声扰民', value: 132, color: '#ff6b6b' },
        { label: '校园周边占道经营', value: 118, color: '#ff8f6b' },
        { label: '沿街商铺油烟投诉', value: 104, color: '#ffb561' },
        { label: '商业街消防通道堵塞', value: 92, color: '#ff7f96' },
        { label: '学校周边交通秩序整治', value: 86, color: '#ff9f43' },
      ],
      streetTop5: [
        { label: '石牌街道办', value: 96, color: '#ff6b6b' },
        { label: '北京街道办', value: 84, color: '#ff8f6b' },
        { label: '新港街道办', value: 78, color: '#ffb561' },
        { label: '同和街道办', value: 66, color: '#ff7f96' },
        { label: '嘉禾街道办', value: 58, color: '#ff9f43' },
      ],
      units: [
        { label: '城管执法队', volume: 126, rate: 32 },
        { label: '住建局', volume: 114, rate: 28 },
        { label: '生态环境分局', volume: 103, rate: 24 },
        { label: '消防救援站', volume: 88, rate: 21 },
        { label: '交警支队', volume: 76, rate: 18 },
      ],
    },
    'warning-in-transit': {
      layout: 'warning-detail',
      subtitle: '在途工单异常',
      hotspotTop5: [
        { label: '道路积水重复上报', value: 128, color: '#ff6b6b' },
        { label: '老旧小区停车矛盾', value: 116, color: '#ff8f6b' },
        { label: '商业综合体秩序问题', value: 98, color: '#ffb561' },
        { label: '住宅区充电安全隐患', value: 84, color: '#ff7f96' },
        { label: '餐饮集中区油烟异味', value: 72, color: '#ff9f43' },
      ],
      streetTop5: [
        { label: '员村街道办', value: 88, color: '#ff6b6b' },
        { label: '东山街道办', value: 79, color: '#ff8f6b' },
        { label: '江南中街道办', value: 70, color: '#ffb561' },
        { label: '南村镇街道办', value: 63, color: '#ff7f96' },
        { label: '棠景街道办', value: 55, color: '#ff9f43' },
      ],
      units: [
        { label: '天河区政务服务中心', volume: 138, rate: 26 },
        { label: '越秀区城运中心', volume: 124, rate: 22 },
        { label: '海珠区综合治理办', volume: 112, rate: 19 },
        { label: '番禺区街面治理专班', volume: 96, rate: 17 },
        { label: '白云区热线联动中心', volume: 82, rate: 15 },
      ],
    },
    'warning-avg-duration': {
      layout: 'warning-detail',
      subtitle: '平均时长异常',
      hotspotTop5: [
        { label: '高层住宅电梯故障', value: 122, color: '#ff6b6b' },
        { label: '商业街消防通道堵塞', value: 110, color: '#ff8f6b' },
        { label: '老旧社区照明故障投诉', value: 96, color: '#ffb561' },
        { label: '城中村环境卫生反复投诉', value: 82, color: '#ff7f96' },
        { label: '夜间施工噪声扰民', value: 74, color: '#ff9f43' },
      ],
      streetTop5: [
        { label: '珠江街道办', value: 86, color: '#ff6b6b' },
        { label: '洪桥街道办', value: 78, color: '#ff8f6b' },
        { label: '赤岗街道办', value: 69, color: '#ffb561' },
        { label: '大石街道办', value: 61, color: '#ff7f96' },
        { label: '同和街道办', value: 53, color: '#ff9f43' },
      ],
      units: [
        { label: '住建局', volume: 118, rate: 21 },
        { label: '消防救援站', volume: 106, rate: 19 },
        { label: '照明管理所', volume: 90, rate: 17 },
        { label: '城管执法队', volume: 84, rate: 14 },
        { label: '街道办', volume: 72, rate: 12 },
      ],
    },
    performance: {
      layout: 'performance-detail',
      subtitle: activeUnit || '承办绩效分析',
      kpis: [
        { label: '预逾期工单量', value: 18, unit: '件', key: 'pre-overdue' },
        { label: '超期工单量', value: 7, unit: '件', key: 'overdue' },
        { label: '紧急工单量', value: 12, unit: '件', key: 'urgent' },
        { label: '即将逾期剩余时间', value: 3.5, unit: '小时', key: 'expiring-soon' },
      ],
      scoreTrend: [92.4, 93.1, 94.6, 95.2, 95.8, 96.8],
      scoreItems: [
        { label: '签收及时率', value: 96, belowAvg: false },
        { label: '办结及时率', value: 94, belowAvg: false },
        { label: '回访满意率', value: 91, belowAvg: true },
        { label: '退单控制', value: 89, belowAvg: true },
        { label: '协同联办', value: 93, belowAvg: false },
      ],
    },
  }[metric] ?? {
    layout: 'summary',
    subtitle: '诉求工单分析',
    regions: [],
    top10: [],
  };

  if (!activeUnit) return config;

  return {
    ...config,
    subtitle: config.layout === 'performance-detail' ? config.subtitle : `${activeUnit} · ${config.subtitle}`,
  };
}

function renderSpecialAnalysisOrdersPanel() {
  const panel = document.querySelector('[data-special-analysis-orders-panel]');
  if (!panel) return;
  panel.dataset.specialAnalysisOrdersState = SPECIAL_ANALYSIS_ORDERS_STATE.isOpen ? 'open' : 'closed';
  if (!SPECIAL_ANALYSIS_ORDERS_STATE.isOpen) return;

  const config = getSpecialAnalysisOrdersPanelConfig();
  panel.dataset.specialAnalysisOrdersLayout = config.layout ?? 'default';
  const title = panel.querySelector('[data-special-analysis-orders-title]');
  const subtitle = panel.querySelector('[data-special-analysis-orders-subtitle]');
  const content = panel.querySelector('[data-special-analysis-orders-panel-content]');

  if (title) {
    title.textContent = config.layout === 'performance-detail'
      ? '承办绩效分析'
      : config.layout === 'governance-warning-detail'
        ? '治理要点预警分析'
        : config.layout === 'kpi-unit-ranking'
          ? '单位排名'
          : '诉求工单分析';
  }
  if (subtitle) subtitle.textContent = config.subtitle;
  if (!content) return;

  if (config.layout === 'in-transit') {
    renderSpecialAnalysisInTransitPanel(content, config);
    return;
  }

  if (config.layout === 'warning-detail') {
    renderSpecialAnalysisWarningDetailPanel(content, config);
    return;
  }

  if (config.layout === 'governance-warning-detail') {
    renderSpecialAnalysisGovernanceWarningDetailPanel(content, config);
    return;
  }

  if (config.layout === 'kpi-unit-ranking') {
    renderSpecialAnalysisKpiUnitRankingPanel(content, config);
    return;
  }

  if (config.layout === 'performance-detail') {
    renderSpecialAnalysisPerformanceDetailPanel(content, config);
    return;
  }

  if (config.layout === 'orders-more') {
    renderSpecialAnalysisOrdersMorePanel(content, config);
    return;
  }

  if (config.layout === 'unit-dispatch') {
    renderSpecialAnalysisUnitDispatchPanel(content, config);
    return;
  }

  content.innerHTML = `
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">区域分布排名</span>
        <span class="map-orders-card__meta">横向条状图</span>
      </div>
      <div class="map-orders-card__content" data-special-analysis-orders-region-rank></div>
    </section>
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">工单量排名 Top10 区域</span>
        <span class="map-orders-card__meta">柱状图</span>
      </div>
      <div class="map-orders-card__content province-chart province-chart--bars" data-special-analysis-orders-top10-chart></div>
    </section>
  `;

  const regionRank = content.querySelector('[data-special-analysis-orders-region-rank]');
  const top10Chart = content.querySelector('[data-special-analysis-orders-top10-chart]');
  if (regionRank) renderSpecialAnalysisOrdersRegionRankChart(regionRank, config.regions);
  if (top10Chart) renderSpecialAnalysisOrdersTop10Chart(top10Chart, config.top10);
}

function renderSpecialAnalysisOrdersRegionRankChart(container, items) {
  if (!container) return;
  const max = Math.max(...items.map((item) => item.value), 1);
  const suffix = SPECIAL_ANALYSIS_ORDERS_STATE.metric === 'avg-duration' ? '小时' : SPECIAL_ANALYSIS_ORDERS_STATE.metric === 'change-rate' ? '%' : '件';
  container.innerHTML = `
    <div class="map-orders-rank special-analysis-orders-panel__rank-list">
      ${items
        .map(
          (item, index) => `
            <article class="map-orders-rank__item special-analysis-orders-panel__rank-item">
              <span class="map-orders-rank__index">${String(index + 1).padStart(2, '0')}</span>
              <div class="map-orders-rank__main">
                <div class="map-orders-rank__head">
                  <span class="map-orders-rank__label">${item.label}</span>
                  <span class="map-orders-rank__value">${item.value}${suffix}</span>
                </div>
                <div class="map-orders-rank__track">
                  <span class="map-orders-rank__bar" style="width:${(item.value / max) * 100}%"></span>
                </div>
              </div>
            </article>
          `
        )
        .join('')}
    </div>
  `;
}

function renderSpecialAnalysisOrdersTop10Chart(container, items) {
  if (!container) return;
  const width = container.clientWidth || 420;
  const height = container.clientHeight || 240;
  const baselineY = height - 28;
  const chartHeight = height - 48;
  const max = Math.max(...items.map((item) => item.value), 1);
  const slotWidth = width / Math.max(items.length, 1);
  const barWidth = Math.min(24, slotWidth * 0.52);
  const bars = items
    .map((item, index) => {
      const x = slotWidth * index + (slotWidth - barWidth) / 2;
      const barHeight = (item.value / max) * chartHeight;
      const y = baselineY - barHeight;
      return `
        <g>
          <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="4" fill="${item.color ?? '#57b8ff'}"></rect>
          <text x="${(x + barWidth / 2).toFixed(2)}" y="${(y - 8).toFixed(2)}" fill="rgba(220,245,255,0.88)" font-size="10" text-anchor="middle">${item.value}</text>
          <text x="${(x + barWidth / 2).toFixed(2)}" y="${(height - 8).toFixed(2)}" fill="rgba(152,188,208,0.72)" font-size="10" text-anchor="middle">${item.label}</text>
        </g>
      `;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="0" x2="${width}" y1="${baselineY}" y2="${baselineY}" stroke="var(--dt-chart-line-dim)" stroke-width="1"></line>
      ${bars}
    </svg>
  `;
}

function renderSpecialAnalysisInTransitPanel(container, config) {
  const depts = config.depts ?? [];
  const activeDept = depts.find((item) => item.name === SPECIAL_ANALYSIS_ORDERS_STATE.activeDept) ?? depts[0] ?? null;
  if (!SPECIAL_ANALYSIS_ORDERS_STATE.activeDept && activeDept) {
    SPECIAL_ANALYSIS_ORDERS_STATE.activeDept = activeDept.name;
  }

  container.innerHTML = `
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">办理部门排名</span>
        <span class="map-orders-card__meta">点击联动</span>
      </div>
      <div class="map-orders-card__content special-analysis-orders-panel__dept-list" data-special-analysis-orders-dept-list></div>
    </section>
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">在途工单量趋势</span>
        <span class="map-orders-card__meta">折线图</span>
      </div>
      <div class="map-orders-card__content special-analysis-orders-panel__trend-chart" data-special-analysis-orders-trend-chart></div>
    </section>
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">预警工单列表</span>
        <span class="map-orders-card__meta">流式卡片</span>
      </div>
      <div class="map-orders-card__content special-analysis-orders-panel__warning-list" data-special-analysis-orders-warning-list></div>
    </section>
  `;

  const deptList = container.querySelector('[data-special-analysis-orders-dept-list]');
  const trendChart = container.querySelector('[data-special-analysis-orders-trend-chart]');
  const warningList = container.querySelector('[data-special-analysis-orders-warning-list]');

  if (deptList) {
    deptList.innerHTML = depts
      .map(
        (dept, index) => `
          <button class="special-analysis-orders-panel__dept-item${dept.name === SPECIAL_ANALYSIS_ORDERS_STATE.activeDept ? ' special-analysis-orders-panel__dept-item--active' : ''}" type="button" data-special-analysis-orders-dept="${dept.name}">
            <span class="special-analysis-orders-panel__dept-rank">${String(index + 1).padStart(2, '0')}</span>
            <span class="special-analysis-orders-panel__dept-name">${dept.name}</span>
            <span class="special-analysis-orders-panel__dept-count">${dept.count}</span>
          </button>
        `
      )
      .join('');
  }

  if (activeDept && trendChart) {
    renderSpecialAnalysisOrdersTrendChart(trendChart, activeDept.trend);
  }

  if (activeDept && warningList) {
    warningList.innerHTML = activeDept.warnings
      .map(
        (warning, index) => `
          <article class="special-analysis-orders-panel__warning-item">
            <span class="special-analysis-orders-panel__warning-flag">预警 ${String(index + 1).padStart(2, '0')}</span>
            <span class="special-analysis-orders-panel__warning-text">${warning}</span>
          </article>
        `
      )
      .join('');
  }
}

function renderSpecialAnalysisOrdersTrendChart(container, values) {
  const months = ['01', '02', '03', '04', '05', '06'];
  const width = container.clientWidth || 320;
  const height = 180;
  const baselineY = height - 24;
  const chartHeight = height - 42;
  const max = Math.max(...values, 1);
  const slotWidth = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => ({
    x: slotWidth * index,
    y: baselineY - (value / max) * chartHeight,
    value,
  }));
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const dots = points.map((point) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3" fill="#4de0d4"></circle>`).join('');
  const labels = points.map((point, index) => `<text x="${point.x.toFixed(2)}" y="${height - 6}" fill="rgba(152,188,208,0.72)" font-size="10" text-anchor="middle">${months[index]}</text>`).join('');
  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="0" x2="${width}" y1="${baselineY}" y2="${baselineY}" stroke="var(--dt-chart-line-dim)" stroke-width="1"></line>
      <path d="${path}" fill="none" stroke="#4de0d4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${dots}
      ${labels}
    </svg>
  `;
}

function renderSpecialAnalysisOrdersTypeChart(container, items) {
  if (!container) return;
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const cx = 104;
  const cy = 90;
  const radius = 62;
  let startAngle = -Math.PI / 2;

  const slices = items.map((item, index) => {
    const angle = (item.value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const color = ['#57b8ff', '#4de0d4', '#8b9bff', '#ffb561', '#73d5ff'][index % 5];
    const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    startAngle = endAngle;
    return { path, color, item };
  });

  const legend = slices.map(({ color, item }, index) => {
    const percent = ((item.value / total) * 100).toFixed(1);
    return `
      <div class="special-analysis-orders-panel__type-legend-item">
        <span class="special-analysis-orders-panel__type-legend-main">
          <span class="special-analysis-orders-panel__type-legend-dot" style="background:${color}"></span>
          <span class="special-analysis-orders-panel__type-legend-label">${item.label}</span>
        </span>
        <span class="special-analysis-orders-panel__type-legend-value">${item.value} / ${percent}%</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="special-analysis-orders-panel__type-layout">
      <svg viewBox="0 0 220 180" class="special-analysis-orders-panel__type-svg" aria-hidden="true">
        ${slices.map(({ path, color }) => `<path d="${path}" fill="${color}"></path>`).join('')}
        <circle cx="${cx}" cy="${cy}" r="28" fill="rgba(8,20,36,0.95)"></circle>
        <text x="${cx}" y="${cy + 4}" fill="var(--dt-text-emphasis)" font-size="12" font-weight="600" text-anchor="middle">类型</text>
      </svg>
      <div class="special-analysis-orders-panel__type-legend">${legend}</div>
    </div>
  `;
}

function renderSpecialAnalysisWarningDetailPanel(container, config) {
  container.innerHTML = `
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">工单量变化具体热点 Top5</span>
        <span class="map-orders-card__meta">柱状图</span>
      </div>
      <div class="map-orders-card__content province-chart province-chart--bars" data-special-analysis-warning-hotspot-chart></div>
    </section>
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">街办 Top5</span>
        <span class="map-orders-card__meta">柱状图</span>
      </div>
      <div class="map-orders-card__content province-chart province-chart--bars" data-special-analysis-warning-street-chart></div>
    </section>
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">承办单位 Top5 工单量和变化率</span>
        <span class="map-orders-card__meta">双柱状图</span>
      </div>
      <div class="map-orders-card__content special-analysis-orders-panel__dual-chart" data-special-analysis-warning-unit-chart></div>
    </section>
  `;

  const hotspotChart = container.querySelector('[data-special-analysis-warning-hotspot-chart]');
  const streetChart = container.querySelector('[data-special-analysis-warning-street-chart]');
  const unitChart = container.querySelector('[data-special-analysis-warning-unit-chart]');

  if (hotspotChart) renderSpecialAnalysisOrdersTop10Chart(hotspotChart, config.hotspotTop5 ?? []);
  if (streetChart) renderSpecialAnalysisOrdersTop10Chart(streetChart, config.streetTop5 ?? []);
  if (unitChart) renderSpecialAnalysisWarningUnitChart(unitChart, config.units ?? []);
}

function renderSpecialAnalysisWarningUnitChart(container, items) {
  if (!container) return;
  const width = container.clientWidth || 320;
  const height = 220;
  const baselineY = height - 30;
  const chartHeight = height - 54;
  const maxVolume = Math.max(...items.map((item) => item.volume), 1);
  const maxRate = Math.max(...items.map((item) => item.rate), 1);
  const slotWidth = width / Math.max(items.length, 1);
  const barWidth = Math.min(16, slotWidth * 0.24);

  const groups = items
    .map((item, index) => {
      const groupX = slotWidth * index + slotWidth / 2;
      const volumeHeight = (item.volume / maxVolume) * chartHeight;
      const rateHeight = (item.rate / maxRate) * chartHeight;
      const volumeX = groupX - barWidth - 3;
      const rateX = groupX + 3;
      return `
        <g>
          <rect x="${volumeX.toFixed(2)}" y="${(baselineY - volumeHeight).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${volumeHeight.toFixed(2)}" rx="3" fill="#ff6b6b"></rect>
          <rect x="${rateX.toFixed(2)}" y="${(baselineY - rateHeight).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${rateHeight.toFixed(2)}" rx="3" fill="#ffb561"></rect>
          <text x="${groupX.toFixed(2)}" y="${(height - 8).toFixed(2)}" fill="rgba(152,188,208,0.72)" font-size="9" text-anchor="middle">${item.label}</text>
        </g>
      `;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="0" x2="${width}" y1="${baselineY}" y2="${baselineY}" stroke="var(--dt-chart-line-dim)" stroke-width="1"></line>
      ${groups}
    </svg>
    <div class="special-analysis-orders-panel__dual-legend">
      <span class="special-analysis-orders-panel__legend-item"><span class="special-analysis-orders-panel__legend-dot special-analysis-orders-panel__legend-dot--volume"></span>工单量</span>
      <span class="special-analysis-orders-panel__legend-item"><span class="special-analysis-orders-panel__legend-dot special-analysis-orders-panel__legend-dot--rate"></span>变化率</span>
    </div>
  `;
}

function renderSpecialAnalysisSimpleBarChart(container, items, suffix = '件') {
  if (!container) return;
  const max = Math.max(...items.map((item) => item.value), 1);
  container.innerHTML = `
    <div class="map-orders-rank special-analysis-orders-panel__rank-list">
      ${items
        .map(
          (item, index) => `
            <article class="map-orders-rank__item special-analysis-orders-panel__rank-item">
              <span class="map-orders-rank__index">${String(index + 1).padStart(2, '0')}</span>
              <div class="map-orders-rank__main">
                <div class="map-orders-rank__head">
                  <span class="map-orders-rank__label">${item.label}</span>
                  <span class="map-orders-rank__value">${item.value}${suffix}</span>
                </div>
                <div class="map-orders-rank__track">
                  <span class="map-orders-rank__bar" style="width:${(item.value / max) * 100}%"></span>
                </div>
              </div>
            </article>
          `
        )
        .join('')}
    </div>
  `;
}

function renderSpecialAnalysisGovernanceWarningTicketList(container, items) {
  if (!container) return;
  container.innerHTML = `
    <div class="special-analysis-orders-panel__governance-ticket-list">
      ${items
        .map(
          (item) => `
            <article class="special-analysis-orders-panel__governance-ticket-item">
              <div class="special-analysis-orders-panel__governance-ticket-main">
                <div class="special-analysis-orders-panel__governance-ticket-title">${item.title}</div>
                <div class="special-analysis-orders-panel__governance-ticket-meta"><span>承办单位：${item.unit}</span><span>${item.time}</span></div>
                <div class="special-analysis-orders-panel__governance-ticket-time"><span>${item.process}</span></div>
              </div>
              <div class="special-analysis-orders-panel__governance-ticket-side"><span class="map-workbench__status map-workbench__status--${item.status.includes('重点') ? 'alert' : item.status.includes('持续') ? 'pending' : 'active'}">${item.status}</span></div>
            </article>
          `
        )
        .join('')}
    </div>
  `;
}

function renderSpecialAnalysisGovernanceWarningDetailPanel(container, config) {
  container.innerHTML = `
    <div class="special-analysis-orders-panel__governance-grid">
      <section class="map-orders-card">
        <div class="map-orders-card__head">
          <span class="map-orders-card__title">群发事项</span>
          <span class="map-orders-card__meta">横向条状图</span>
        </div>
        <div class="map-orders-card__content" data-special-analysis-governance-group-chart></div>
      </section>
      <section class="map-orders-card">
        <div class="map-orders-card__head">
          <span class="map-orders-card__title">多发事项</span>
          <span class="map-orders-card__meta">横向条状图</span>
        </div>
        <div class="map-orders-card__content" data-special-analysis-governance-frequent-chart></div>
      </section>
      <section class="map-orders-card">
        <div class="map-orders-card__head">
          <span class="map-orders-card__title">区域乱点事项</span>
          <span class="map-orders-card__meta">横向条状图</span>
        </div>
        <div class="map-orders-card__content" data-special-analysis-governance-chaos-chart></div>
      </section>
      <section class="map-orders-card">
        <div class="map-orders-card__head">
          <span class="map-orders-card__title">事项演化趋势</span>
          <span class="map-orders-card__meta">折线图</span>
        </div>
        <div class="map-orders-card__content special-analysis-orders-panel__trend-chart" data-special-analysis-governance-trend-chart></div>
      </section>
      <section class="map-orders-card special-analysis-orders-panel__governance-list-card">
        <div class="map-orders-card__head">
          <span class="map-orders-card__title">工单列表</span>
          <span class="map-orders-card__meta">列表</span>
        </div>
        <div class="map-orders-card__content special-analysis-orders-panel__governance-list" data-special-analysis-governance-ticket-list></div>
      </section>
    </div>
  `;

  renderSpecialAnalysisSimpleBarChart(container.querySelector('[data-special-analysis-governance-group-chart]'), config.groupIssues ?? []);
  renderSpecialAnalysisSimpleBarChart(container.querySelector('[data-special-analysis-governance-frequent-chart]'), config.frequentIssues ?? []);
  renderSpecialAnalysisSimpleBarChart(container.querySelector('[data-special-analysis-governance-chaos-chart]'), config.chaosAreas ?? []);
  renderSpecialAnalysisOrdersTrendChart(container.querySelector('[data-special-analysis-governance-trend-chart]'), config.trend ?? []);
  renderSpecialAnalysisGovernanceWarningTicketList(container.querySelector('[data-special-analysis-governance-ticket-list]'), config.tickets ?? []);
}

function getSpecialAnalysisTicketConfig() {
  return {
    'pre-overdue': {
      title: '预逾期工单量',
      items: [
        { id: 'sa-ticket-1', title: '天河区夜间施工噪声工单即将逾期', status: '预逾期', time: '剩余 3小时', unit: '天河区政务服务中心', process: '受理 → 派单 → 办理中', currentTime: '2026-06-01 14:20', content: '群众反映夜间施工噪声持续扰民，要求立即处置。', result: '已派发属地街道核查，待反馈处置结果。', handler: '天河区政务服务中心' },
        { id: 'sa-ticket-2', title: '越秀区油烟扰民工单临近超时', status: '预逾期', time: '剩余 2小时', unit: '越秀区城运中心', process: '受理 → 派单 → 部门签收', currentTime: '2026-06-01 14:20', content: '群众投诉沿街商铺油烟扰民，影响正常生活。', result: '生态环境分局已签收，现场核查中。', handler: '越秀区城运中心' }
      ],
    },
    overdue: {
      title: '超期工单量',
      items: [
        { id: 'sa-ticket-3', title: '海珠区道路积水工单已超期', status: '超期', time: '超期 5小时', unit: '海珠区综合治理办', process: '受理 → 派单 → 办理中 → 超期', currentTime: '2026-06-01 14:20', content: '道路积水影响车辆通行，要求尽快处理。', result: '区防汛办现场抽排中，待处置完成。', handler: '海珠区综合治理办' },
        { id: 'sa-ticket-4', title: '番禺区消防通道堵塞工单超期未办结', status: '超期', time: '超期 3小时', unit: '番禺区街面治理专班', process: '受理 → 派单 → 催办 → 超期', currentTime: '2026-06-01 14:20', content: '商业街消防通道被占用，存在安全隐患。', result: '现场已清障，等待办结回传。', handler: '番禺区街面治理专班' }
      ],
    },
    urgent: {
      title: '紧急工单量',
      items: [
        { id: 'sa-ticket-5', title: '白云区紧急充电安全隐患工单', status: '紧急', time: '紧急处置', unit: '白云区热线联动中心', process: '受理 → 派单 → 应急处置', currentTime: '2026-06-01 14:20', content: '住宅区充电线路冒烟，存在火灾风险。', result: '消防救援站已到场处置。', handler: '白云区热线联动中心' },
        { id: 'sa-ticket-6', title: '天河区电梯困人工单', status: '紧急', time: '紧急处置', unit: '天河区政务服务中心', process: '受理 → 派单 → 联动救援', currentTime: '2026-06-01 14:20', content: '高层住宅电梯故障有人被困，需立即救援。', result: '应急联动中心和维保单位已赶赴现场。', handler: '天河区政务服务中心' }
      ],
    },
    'expiring-soon': {
      title: '即将逾期剩余时间',
      items: [
        { id: 'sa-ticket-7', title: '越秀区占道经营工单 3.5 小时后逾期', status: '即将逾期', time: '剩余 3.5小时', unit: '越秀区城运中心', process: '受理 → 派单 → 办理中', currentTime: '2026-06-01 14:20', content: '学校周边占道经营影响通行秩序。', result: '城管执法队准备现场整治。', handler: '越秀区城运中心' },
        { id: 'sa-ticket-8', title: '海珠区停车矛盾工单 2 小时后逾期', status: '即将逾期', time: '剩余 2小时', unit: '海珠区综合治理办', process: '受理 → 派单 → 部门签收', currentTime: '2026-06-01 14:20', content: '老旧小区停车矛盾引发重复投诉。', result: '街道办已签收，待协调反馈。', handler: '海珠区综合治理办' }
      ],
    },
  }[SPECIAL_ANALYSIS_TICKET_STATE.category] ?? { title: '工单列表', items: [] };
}

function renderSpecialAnalysisTicketPanel() {
  const panel = document.querySelector('[data-special-analysis-ticket-panel]');
  if (!panel) return;
  panel.dataset.specialAnalysisTicketState = SPECIAL_ANALYSIS_TICKET_STATE.isOpen ? 'open' : 'closed';
  if (!SPECIAL_ANALYSIS_TICKET_STATE.isOpen) return;

  const config = getSpecialAnalysisTicketConfig();
  const title = panel.querySelector('[data-special-analysis-ticket-title]');
  const list = panel.querySelector('[data-special-analysis-ticket-list]');
  if (title) title.textContent = config.title;
  if (list) {
    list.innerHTML = config.items.map((item, index) => `
      <article class="map-workbench__item" data-special-analysis-ticket-item="${item.id}" role="button" tabindex="0" aria-label="打开${item.title}工单详情">
        <div class="map-workbench__item-icon"><span class="map-workbench__item-icon-core">${String(index + 1).padStart(2, '0')}</span></div>
        <div class="map-workbench__item-main">
          <div class="map-workbench__item-title">${item.title}</div>
          <div class="map-workbench__item-meta"><span>承办单位：${item.unit}</span><span>${item.time}</span></div>
          <div class="map-workbench__item-time"><span>${item.process}</span></div>
        </div>
        <div class="map-workbench__item-side"><span class="map-workbench__status map-workbench__status--${item.status.includes('超期') ? 'alert' : item.status.includes('紧急') ? 'pending' : 'active'}">${item.status}</span></div>
      </article>
    `).join('');
  }
}

function openSpecialAnalysisTicketPanel(category) {
  SPECIAL_ANALYSIS_TICKET_STATE.isOpen = true;
  SPECIAL_ANALYSIS_TICKET_STATE.category = category;
  renderSpecialAnalysisTicketPanel();
}

function closeSpecialAnalysisTicketPanel() {
  SPECIAL_ANALYSIS_TICKET_STATE.isOpen = false;
  renderSpecialAnalysisTicketPanel();
}

function getSpecialAnalysisTicketDetailItem() {
  const config = getSpecialAnalysisTicketConfig();
  return config.items.find((item) => item.id === SPECIAL_ANALYSIS_TICKET_DETAIL_STATE.itemId) ?? null;
}

function renderSpecialAnalysisTicketDetailPanel() {
  const panel = document.querySelector('[data-special-analysis-ticket-detail-panel]');
  if (!panel) return;
  panel.dataset.specialAnalysisTicketDetailState = SPECIAL_ANALYSIS_TICKET_DETAIL_STATE.isOpen ? 'open' : 'closed';
  if (!SPECIAL_ANALYSIS_TICKET_DETAIL_STATE.isOpen) return;

  const item = getSpecialAnalysisTicketDetailItem();
  if (!item) return;
  const title = panel.querySelector('[data-special-analysis-ticket-detail-title]');
  const grid = panel.querySelector('[data-special-analysis-ticket-detail-grid]');
  if (title) title.textContent = item.title;
  if (grid) {
    grid.innerHTML = [
      ['所有流程状态', item.process],
      ['承办单位', item.handler],
      ['当前时间', item.currentTime],
      ['诉求内容', item.content],
      ['办理结果', item.result],
      ['工单状态', item.status],
    ].map(([label, value]) => `
      <div class="map-detail-workbench__field${label === '诉求内容' || label === '办理结果' ? ' map-detail-workbench__field--full' : ''}">
        <span class="map-detail-workbench__field-label">${label}</span>
        <span class="map-detail-workbench__field-value">${value}</span>
      </div>
    `).join('');
  }
}

function openSpecialAnalysisTicketDetailPanel(itemId) {
  SPECIAL_ANALYSIS_TICKET_DETAIL_STATE.isOpen = true;
  SPECIAL_ANALYSIS_TICKET_DETAIL_STATE.itemId = itemId;
  renderSpecialAnalysisTicketDetailPanel();
}

function closeSpecialAnalysisTicketDetailPanel() {
  SPECIAL_ANALYSIS_TICKET_DETAIL_STATE.isOpen = false;
  renderSpecialAnalysisTicketDetailPanel();
}

function renderSpecialAnalysisPerformanceDetailPanel(container, config) {
  container.innerHTML = `
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">特殊工单监管</span>
        <span class="map-orders-card__meta">两行两列</span>
      </div>
      <div class="map-orders-card__content special-analysis-orders-panel__performance-kpis" data-special-analysis-performance-kpis></div>
    </section>
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">单位分值变化趋势</span>
        <span class="map-orders-card__meta">折线图</span>
      </div>
      <div class="map-orders-card__content special-analysis-orders-panel__trend-chart" data-special-analysis-performance-trend></div>
    </section>
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">子项指标得分情况</span>
        <span class="map-orders-card__meta">低于平均分标红</span>
      </div>
      <div class="map-orders-card__content special-analysis-orders-panel__performance-score" data-special-analysis-performance-score></div>
    </section>
  `;

  const kpis = container.querySelector('[data-special-analysis-performance-kpis]');
  const trend = container.querySelector('[data-special-analysis-performance-trend]');
  const score = container.querySelector('[data-special-analysis-performance-score]');

  if (kpis) {
    kpis.innerHTML = (config.kpis ?? [])
      .map(
        (item) => `
          <button class="special-analysis-orders-panel__performance-kpi" type="button" data-special-analysis-ticket-trigger="${item.key}">
            <span class="special-analysis-orders-panel__performance-kpi-label">${item.label}</span>
            <div class="special-analysis-orders-panel__performance-kpi-value-row">
              <span class="special-analysis-orders-panel__performance-kpi-value">${item.value}</span>
              <span class="special-analysis-orders-panel__performance-kpi-unit">${item.unit}</span>
            </div>
          </button>
        `
      )
      .join('');
  }

  if (trend) {
    renderSpecialAnalysisPerformanceTrendChart(trend, config.scoreTrend ?? []);
  }

  if (score) {
    renderSpecialAnalysisPerformanceScoreChart(score, config.scoreItems ?? []);
  }
}

function renderSpecialAnalysisOrdersMorePanel(container, config) {
  container.innerHTML = `
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">承办量排名 Top5 单位</span>
        <span class="map-orders-card__meta">横向条状图</span>
      </div>
      <div class="map-orders-card__content" data-special-analysis-orders-more-undertaking></div>
    </section>
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">办理量排名 Top5 单位</span>
        <span class="map-orders-card__meta">横向条状图</span>
      </div>
      <div class="map-orders-card__content" data-special-analysis-orders-more-handling></div>
    </section>
  `;

  const undertaking = container.querySelector('[data-special-analysis-orders-more-undertaking]');
  const handling = container.querySelector('[data-special-analysis-orders-more-handling]');
  if (undertaking) renderSpecialAnalysisOrdersMetaRankChart(undertaking, config.undertakingTop5 ?? []);
  if (handling) renderSpecialAnalysisOrdersMetaRankChart(handling, config.handlingTop5 ?? []);
}

function renderSpecialAnalysisKpiUnitRankingPanel(container, config) {
  container.innerHTML = `
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">前五名单位</span>
        <span class="map-orders-card__meta">Top5</span>
      </div>
      <div class="map-orders-card__content" data-special-analysis-kpi-ranking-top></div>
    </section>
    <section class="map-orders-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">后五名单位</span>
        <span class="map-orders-card__meta">Bottom5</span>
      </div>
      <div class="map-orders-card__content" data-special-analysis-kpi-ranking-bottom></div>
    </section>
  `;

  const top = container.querySelector('[data-special-analysis-kpi-ranking-top]');
  const bottom = container.querySelector('[data-special-analysis-kpi-ranking-bottom]');
  if (top) renderSpecialAnalysisOrdersMetaRankChart(top, config.top5 ?? []);
  if (bottom) renderSpecialAnalysisOrdersMetaRankChart(bottom, config.bottom5 ?? []);
}

function renderSpecialAnalysisPerformanceTrendChart(container, values) {
  if (!container) return;
  const labels = ['1月', '2月', '3月', '4月', '5月', '6月'];
  const width = container.clientWidth || 320;
  const height = 180;
  const baselineY = height - 24;
  const chartHeight = height - 42;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, max);
  const range = max - min || 1;
  const slotWidth = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => ({
    x: slotWidth * index,
    y: baselineY - ((value - min) / range) * chartHeight,
    value,
  }));
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const dots = points.map((point) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3" fill="#57b8ff"></circle>`).join('');
  const labelsSvg = points.map((point, index) => `<text x="${point.x.toFixed(2)}" y="${height - 6}" fill="rgba(152,188,208,0.72)" font-size="10" text-anchor="middle">${labels[index]}</text>`).join('');
  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="0" x2="${width}" y1="${baselineY}" y2="${baselineY}" stroke="var(--dt-chart-line-dim)" stroke-width="1"></line>
      <path d="${path}" fill="none" stroke="#57b8ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${dots}
      ${labelsSvg}
    </svg>
  `;
}

function renderSpecialAnalysisPerformanceScoreChart(container, items) {
  if (!container) return;
  const width = 320;
  const height = 220;
  const centerX = width / 2;
  const centerY = height / 2 - 10;
  const radius = 72;
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  let startAngle = -90;
  const slices = items.map((item) => {
    const angle = (item.value / total) * 360;
    const endAngle = startAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;
    const x1 = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
    const y1 = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
    const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
    const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);
    const color = item.belowAvg ? '#ff6b6b' : ['#57b8ff', '#4de0d4', '#8b9bff', '#ffb561', '#73d5ff'][items.indexOf(item) % 5];
    const path = `M ${centerX} ${centerY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    startAngle = endAngle;
    return `<path d="${path}" fill="${color}"/>`;
  }).join('');

  const legend = items.map((item, index) => {
    const color = item.belowAvg ? '#ff6b6b' : ['#57b8ff', '#4de0d4', '#8b9bff', '#ffb561', '#73d5ff'][index % 5];
    const lx = 12 + (index % 2) * 146;
    const ly = 184 + Math.floor(index / 2) * 16;
    return `
      <rect x="${lx}" y="${ly - 8}" width="10" height="10" rx="2" fill="${color}"></rect>
      <text x="${lx + 14}" y="${ly}" fill="${item.belowAvg ? '#ff9b9b' : 'rgba(152,188,208,0.8)'}" font-size="10">${item.label} ${item.value}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" style="width:100%;height:100%;">
      ${slices}
      <circle cx="${centerX}" cy="${centerY}" r="32" fill="rgba(8,20,36,0.95)"></circle>
      <text x="${centerX}" y="${centerY + 5}" fill="var(--dt-text-emphasis)" font-size="13" font-weight="600" text-anchor="middle">指标得分</text>
      ${legend}
    </svg>
  `;
}

function renderSpecialAnalysisOrdersMetaRankChart(container, items) {
  if (!container) return;
  const max = Math.max(...items.map((item) => item.value), 1);
  container.innerHTML = `
    <div class="map-orders-rank special-analysis-orders-panel__rank-list">
      ${items
        .map(
          (item, index) => `
            <button class="map-orders-rank__item special-analysis-orders-panel__rank-item special-analysis-orders-panel__rank-item--interactive" type="button" data-special-analysis-orders-unit="${item.label}">
              <span class="map-orders-rank__index">${String(index + 1).padStart(2, '0')}</span>
              <div class="map-orders-rank__main special-analysis-orders-panel__meta-rank-main">
                <div class="map-orders-rank__head">
                  <span class="map-orders-rank__label">${item.label}</span>
                  <span class="map-orders-rank__value">${item.value}</span>
                </div>
                <div class="map-orders-rank__track">
                  <span class="map-orders-rank__bar" style="width:${(item.value / max) * 100}%"></span>
                </div>
                <div class="special-analysis-orders-panel__meta-note">${item.meta}</div>
              </div>
            </button>
          `
        )
        .join('')}
    </div>
  `;
}

function renderSpecialAnalysisUnitDispatchPanel(container, config) {
  const focusItems = config.focusTop5 ?? [];
  const activeFocus = focusItems.find((item) => item.label === SPECIAL_ANALYSIS_ORDERS_STATE.activeFocus) ?? focusItems[0] ?? null;
  if (!SPECIAL_ANALYSIS_ORDERS_STATE.activeFocus && activeFocus) {
    SPECIAL_ANALYSIS_ORDERS_STATE.activeFocus = activeFocus.label;
  }

  container.innerHTML = `
    <section class="map-orders-card special-analysis-orders-panel__row-card">
      <div class="map-orders-card__head">
        <span class="map-orders-card__title">市民关注项 Top5</span>
        <span class="map-orders-card__meta">流式卡片</span>
      </div>
      <div class="map-orders-card__content special-analysis-orders-panel__focus-list special-analysis-orders-panel__focus-list--wide" data-special-analysis-orders-focus-list></div>
    </section>
    <div class="special-analysis-orders-panel__mid-grid">
      <section class="map-orders-card">
        <div class="map-orders-card__head">
          <span class="map-orders-card__title">工单数量趋势</span>
          <span class="map-orders-card__meta">折线图</span>
        </div>
        <div class="map-orders-card__content special-analysis-orders-panel__trend-chart" data-special-analysis-orders-focus-trend></div>
      </section>
      <section class="map-orders-card">
        <div class="map-orders-card__head">
          <span class="map-orders-card__title">工单类型统计</span>
          <span class="map-orders-card__meta">工单量 / 占比</span>
        </div>
        <div class="map-orders-card__content special-analysis-orders-panel__type-chart" data-special-analysis-orders-focus-type></div>
      </section>
    </div>
    <div class="special-analysis-orders-panel__bottom-grid special-analysis-orders-panel__bottom-grid--wide">
      <section class="map-orders-card">
        <div class="map-orders-card__head">
          <span class="map-orders-card__title">属地分布排行</span>
          <span class="map-orders-card__meta">横向条状图</span>
        </div>
        <div class="map-orders-card__content" data-special-analysis-orders-focus-area></div>
      </section>
      <section class="map-orders-card">
        <div class="map-orders-card__head">
          <span class="map-orders-card__title">办结情况</span>
          <span class="map-orders-card__meta">街办柱状图</span>
        </div>
        <div class="map-orders-card__content province-chart province-chart--bars" data-special-analysis-orders-focus-closure></div>
      </section>
    </div>
  `;

  const focusList = container.querySelector('[data-special-analysis-orders-focus-list]');
  const trend = container.querySelector('[data-special-analysis-orders-focus-trend]');
  const type = container.querySelector('[data-special-analysis-orders-focus-type]');
  const area = container.querySelector('[data-special-analysis-orders-focus-area]');
  const closure = container.querySelector('[data-special-analysis-orders-focus-closure]');

  if (focusList) {
    focusList.innerHTML = focusItems
      .map(
        (item, index) => `
          <button class="special-analysis-orders-panel__focus-item${item.label === SPECIAL_ANALYSIS_ORDERS_STATE.activeFocus ? ' special-analysis-orders-panel__focus-item--active' : ''}" type="button" data-special-analysis-orders-focus="${item.label}">
            <span class="special-analysis-orders-panel__focus-rank">${String(index + 1).padStart(2, '0')}</span>
            <span class="special-analysis-orders-panel__focus-name">${item.label}</span>
          </button>
        `
      )
      .join('');
  }

  if (activeFocus && trend) renderSpecialAnalysisOrdersTrendChart(trend, activeFocus.trend);
  if (activeFocus && type) renderSpecialAnalysisOrdersTypeChart(type, activeFocus.types);
  if (activeFocus && area) renderSpecialAnalysisOrdersRegionRankChart(area, activeFocus.areas);
  if (activeFocus && closure) renderSpecialAnalysisOrdersTop10Chart(closure, activeFocus.closures);
}

function getBottleneckPanelConfig() {
  return {
    '群众多次不满意': {
      subtitle: '群众多次不满意',
      depts: [
        { name: '城管执法队', topics: ['夜间施工噪声扰民', '校园周边占道经营', '沿街商铺油烟投诉', '住宅区充电安全隐患', '老旧小区停车矛盾'], areas: ['天河区', '越秀区', '海珠区', '番禺区', '白云区'] },
        { name: '住建局', topics: ['老旧小区停车矛盾', '商业街消防通道堵塞', '学校周边交通秩序整治', '沿街商铺油烟投诉', '城中村环境卫生反复投诉'], areas: ['海珠区', '番禺区', '天河区', '越秀区', '南山区'] },
        { name: '生态环境分局', topics: ['沿街商铺油烟投诉', '夜间施工噪声扰民', '餐饮集中区油烟异味', '住宅区充电安全隐患', '学校周边交通秩序整治'], areas: ['白云区', '天河区', '海珠区', '番禺区', '越秀区'] },
        { name: '消防救援站', topics: ['住宅区充电安全隐患', '商业街消防通道堵塞', '夜间施工噪声扰民', '学校周边交通秩序整治', '老旧小区停车矛盾'], areas: ['番禺区', '白云区', '天河区', '海珠区', '越秀区'] },
        { name: '交警支队', topics: ['学校周边交通秩序整治', '校园周边占道经营', '夜间施工噪声扰民', '沿街商铺油烟投诉', '商业街消防通道堵塞'], areas: ['天河区', '南山区', '越秀区', '白云区', '海珠区'] },
      ],
    },
    研判批示: {
      subtitle: '研判批示',
      depts: [
        { name: '应急管理局', topics: ['商业街消防通道堵塞', '高层住宅电梯故障', '餐饮集中区油烟异味', '学校周边交通秩序整治', '城中村环境卫生反复投诉'], areas: ['南山区', '天河区', '福田区', '越秀区', '白云区'] },
        { name: '消防救援站', topics: ['住宅区充电安全隐患', '商业街消防通道堵塞', '高层住宅电梯故障', '学校周边交通秩序整治', '老旧小区停车矛盾'], areas: ['福田区', '南山区', '越秀区', '白云区', '海珠区'] },
        { name: '城运中心', topics: ['城中村环境卫生反复投诉', '夜间施工噪声扰民', '沿街商铺油烟投诉', '道路积水重复上报', '商业综合体秩序问题'], areas: ['天河区', '越秀区', '海珠区', '番禺区', '南山区'] },
        { name: '住建局', topics: ['高层住宅电梯故障', '商业街消防通道堵塞', '道路积水重复上报', '餐饮集中区油烟异味', '学校周边交通秩序整治'], areas: ['越秀区', '福田区', '南山区', '海珠区', '白云区'] },
        { name: '市场监管局', topics: ['餐饮集中区油烟异味', '城中村环境卫生反复投诉', '商业综合体秩序问题', '学校周边交通秩序整治', '夜间施工噪声扰民'], areas: ['白云区', '天河区', '番禺区', '越秀区', '南山区'] },
      ],
    },
    多部门推诿: {
      subtitle: '多部门推诿',
      depts: [
        { name: '住建局', topics: ['老旧小区停车矛盾', '道路积水重复上报', '沿街商铺油烟投诉', '商业综合体秩序问题', '住宅区充电安全隐患'], areas: ['海珠区', '番禺区', '天河区', '南山区', '白云区'] },
        { name: '城管执法队', topics: ['沿街商铺油烟投诉', '夜间施工噪声扰民', '学校周边交通秩序整治', '城中村环境卫生反复投诉', '商业街消防通道堵塞'], areas: ['越秀区', '海珠区', '番禺区', '白云区', '天河区'] },
        { name: '街道办', topics: ['商业综合体秩序问题', '老旧小区停车矛盾', '住宅区充电安全隐患', '餐饮集中区油烟异味', '道路积水重复上报'], areas: ['天河区', '南山区', '越秀区', '番禺区', '海珠区'] },
        { name: '生态环境分局', topics: ['餐饮集中区油烟异味', '沿街商铺油烟投诉', '夜间施工噪声扰民', '商业综合体秩序问题', '住宅区充电安全隐患'], areas: ['白云区', '越秀区', '天河区', '海珠区', '番禺区'] },
        { name: '消防救援站', topics: ['商业街消防通道堵塞', '住宅区充电安全隐患', '学校周边交通秩序整治', '老旧小区停车矛盾', '道路积水重复上报'], areas: ['南山区', '天河区', '白云区', '越秀区', '海珠区'] },
      ],
    },
    '部门多次退单或反复退回': {
      subtitle: '部门多次退单或反复退回',
      depts: [
        { name: '市场监管局', topics: ['城中村环境卫生反复投诉', '夜间施工噪声扰民', '商业街消防通道堵塞', '学校周边交通秩序整治', '餐饮集中区油烟异味'], areas: ['番禺区', '越秀区', '海珠区', '南山区', '天河区'] },
        { name: '街道办', topics: ['老旧小区停车矛盾', '沿街商铺油烟投诉', '住宅区充电安全隐患', '商业综合体秩序问题', '城中村环境卫生反复投诉'], areas: ['天河区', '海珠区', '越秀区', '白云区', '番禺区'] },
        { name: '城运中心', topics: ['学校周边交通秩序整治', '道路积水重复上报', '商业街消防通道堵塞', '餐饮集中区油烟异味', '夜间施工噪声扰民'], areas: ['南山区', '天河区', '越秀区', '海珠区', '白云区'] },
        { name: '住建局', topics: ['老旧小区停车矛盾', '商业街消防通道堵塞', '学校周边交通秩序整治', '道路积水重复上报', '住宅区充电安全隐患'], areas: ['白云区', '天河区', '越秀区', '番禺区', '南山区'] },
        { name: '城管执法队', topics: ['沿街商铺油烟投诉', '夜间施工噪声扰民', '城中村环境卫生反复投诉', '餐饮集中区油烟异味', '商业综合体秩序问题'], areas: ['海珠区', '越秀区', '白云区', '天河区', '番禺区'] },
      ],
    },
  }[BOTTLENECK_PANEL_STATE.type] ?? {
    subtitle: '难点堵点分析',
    depts: [],
  };
}

function renderBottleneckPanel() {
  const panel = document.querySelector('[data-bottleneck-panel]');
  if (!panel) return;
  panel.dataset.bottleneckState = BOTTLENECK_PANEL_STATE.isOpen ? 'open' : 'closed';
  if (!BOTTLENECK_PANEL_STATE.isOpen) return;

  const config = getBottleneckPanelConfig();
  const subtitle = panel.querySelector('[data-bottleneck-subtitle]');
  const topicRank = panel.querySelector('[data-bottleneck-topic-rank]');
  const areaRank = panel.querySelector('[data-bottleneck-area-rank]');
  const deptList = panel.querySelector('[data-bottleneck-dept-list]');
  if (subtitle) subtitle.textContent = config.subtitle;

  const activeDept = config.depts.find((item) => item.name === BOTTLENECK_PANEL_STATE.activeDept) ?? config.depts[0] ?? null;
  if (!BOTTLENECK_PANEL_STATE.activeDept && activeDept) {
    BOTTLENECK_PANEL_STATE.activeDept = activeDept.name;
  }

  if (deptList) {
    deptList.innerHTML = config.depts
      .map((dept, index) => `
        <button class="bottleneck-panel__dept-item${dept.name === BOTTLENECK_PANEL_STATE.activeDept ? ' bottleneck-panel__dept-item--active' : ''}" type="button" data-bottleneck-dept="${dept.name}">
          <span class="bottleneck-panel__dept-rank">${String(index + 1).padStart(2, '0')}</span>
          <span class="bottleneck-panel__dept-name">${dept.name}</span>
          <span class="bottleneck-panel__dept-count">${128 - index * 12}</span>
        </button>
      `)
      .join('');
  }

  if (activeDept && topicRank) {
    renderProvinceSharedAxisBarChart(topicRank, activeDept.topics.map((label, index) => ({ label, value: 128 - index * 18, color: ['#57b8ff', '#4de0d4', '#8b9bff', '#ffb561', '#ff6b6b'][index] })));
  }
  if (activeDept && areaRank) {
    renderProvinceSharedAxisBarChart(areaRank, activeDept.areas.map((label, index) => ({ label, value: 116 - index * 16, color: ['#57b8ff', '#4de0d4', '#8b9bff', '#ffb561', '#ff6b6b'][index] })));
  }
}

function renderSpecialAnalysisPanel() {
  const panel = document.querySelector('[data-special-analysis-panel]');
  if (!panel) return;
  panel.dataset.specialAnalysisPanelState = SPECIAL_ANALYSIS_PANEL_STATE.isOpen ? 'open' : 'closed';
}

function renderSpecialAnalysisDetailPanel() {
  const panel = document.querySelector('[data-special-analysis-detail-panel]');
  if (!panel) return;
  panel.dataset.specialAnalysisDetailState = SPECIAL_ANALYSIS_DETAIL_STATE.isOpen ? 'open' : 'closed';
  if (!SPECIAL_ANALYSIS_DETAIL_STATE.isOpen) return;

  const nameEl = panel.querySelector('[data-special-analysis-detail-name]');
  if (nameEl) nameEl.textContent = SPECIAL_ANALYSIS_DETAIL_STATE.itemName;

  const subjectChartEl = panel.querySelector('[data-special-analysis-detail-subject-chart]');
  if (subjectChartEl) {
    const subjectData = generateSpecialAnalysisSubjectData();
    renderAppealDetailBarChart(subjectChartEl, subjectData);
  }

  const trendChartEl = panel.querySelector('[data-special-analysis-detail-trend-chart]');
  if (trendChartEl) {
    const trendData = generateSpecialAnalysisTrendData();
    renderAppealDetailLineChart(trendChartEl, trendData);
  }

  const unitChartEl = panel.querySelector('[data-special-analysis-detail-unit-chart]');
  if (unitChartEl) {
    const unitData = generateSpecialAnalysisUnitData();
    renderAppealDetailPieChart(unitChartEl, unitData);
  }

  const areaChartEl = panel.querySelector('[data-special-analysis-detail-area-chart]');
  if (areaChartEl) {
    const areaData = generateSpecialAnalysisAreaData();
    renderSpecialAnalysisAreaChart(areaChartEl, areaData);
  }
}

function renderAppealDetailPanel() {
  const panel = document.querySelector('[data-appeal-detail-panel]');
  if (!panel) return;

  if (APPEAL_DETAIL_STATE.isOpen) {
    panel.dataset.appealDetailState = 'open';
  } else {
    panel.dataset.appealDetailState = 'closed';
    return;
  }

  // 渲染事项名称
  const nameEl = panel.querySelector('[data-appeal-detail-name]');
  if (nameEl) nameEl.textContent = APPEAL_DETAIL_STATE.itemName;

  // 渲染地理分布柱状图
  const geoChartEl = panel.querySelector('[data-appeal-detail-geo-chart]');
  if (geoChartEl) {
    const geoData = generateGeoData();
    renderAppealDetailBarChart(geoChartEl, geoData);
  }

  // 渲染工单量趋势折线图
  const trendChartEl = panel.querySelector('[data-appeal-detail-trend-chart]');
  if (trendChartEl) {
    const trendData = generateTrendData();
    renderAppealDetailLineChart(trendChartEl, trendData);
  }

  // 渲染关联单位扇形图
  const unitChartEl = panel.querySelector('[data-appeal-detail-unit-chart]');
  if (unitChartEl) {
    const unitData = generateUnitData();
    renderAppealDetailPieChart(unitChartEl, unitData);
  }

  // 渲染属地横向条状图
  const areaChartEl = panel.querySelector('[data-appeal-detail-area-chart]');
  if (areaChartEl) {
    const areaData = generateAreaData();
    renderAppealDetailHorizontalBarChart(areaChartEl, areaData);
  }
}

function generateSpecialAnalysisSubjectData() {
  const subjects = ['街道办', '物业公司', '施工单位', '商户经营方', '社区网格'];
  const baseValue = Math.round(SPECIAL_ANALYSIS_DETAIL_STATE.value / 5);
  return subjects.map((subject, i) => ({
    label: subject,
    value: Math.round(baseValue * (1.18 - i * 0.1)),
    color: ['#57b8ff', '#4de0d4', '#8b9bff', '#ffb561', '#ff6b6b'][i],
  }));
}

function generateSpecialAnalysisTrendData() {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月'];
  const baseValue = Math.max(Math.round(SPECIAL_ANALYSIS_DETAIL_STATE.value / 6), 1);
  const multipliers = [0.68, 0.82, 0.9, 1.04, 0.98, 1.16];
  return months.map((month, i) => ({
    label: month,
    value: Math.max(Math.round(baseValue * multipliers[i]), 1),
  }));
}

function generateSpecialAnalysisUnitData() {
  const units = ['城管执法队', '生态环境分局', '住建局', '消防救援站', '交警支队'];
  const total = SPECIAL_ANALYSIS_DETAIL_STATE.value;
  const percentages = [30, 24, 18, 15, 13];
  return units.map((unit, i) => ({
    label: unit,
    value: Math.round((total * percentages[i]) / 100),
    percent: percentages[i],
    color: ['#57b8ff', '#4de0d4', '#8b9bff', '#ffb561', '#ff6b6b'][i],
  }));
}

const SPECIAL_ANALYSIS_AREA_DRILLDOWN = {
  天河区: ['石牌街道办', '天河南街道办', '林和街道办'],
  越秀区: ['北京街道办', '东山街道办', '洪桥街道办'],
  海珠区: ['新港街道办', '江南中街道办', '赤岗街道办'],
  番禺区: ['市桥街道办', '南村镇街道办', '大石街道办'],
  白云区: ['同和街道办', '嘉禾街道办', '棠景街道办'],
};

function generateSpecialAnalysisAreaData() {
  const baseValue = Math.round(SPECIAL_ANALYSIS_DETAIL_STATE.value / 5);
  if (SPECIAL_ANALYSIS_DETAIL_STATE.areaLevel === 'street' && SPECIAL_ANALYSIS_DETAIL_STATE.activeDistrict) {
    const streets = SPECIAL_ANALYSIS_AREA_DRILLDOWN[SPECIAL_ANALYSIS_DETAIL_STATE.activeDistrict] ?? [];
    return streets.map((street, i) => ({
      label: `${SPECIAL_ANALYSIS_DETAIL_STATE.activeDistrict}-${street}`,
      value: Math.round(baseValue * (0.96 - i * 0.14)),
    }));
  }

  const areas = ['天河区', '越秀区', '海珠区', '番禺区', '白云区'];
  return areas.map((area, i) => ({
    label: area,
    value: Math.round(baseValue * (1 - i * 0.16)),
  }));
}

function generateGeoData() {
  const regions = ['广州', '深圳', '佛山', '东莞', '珠海', '中山', '惠州'];
  const baseValue = Math.round(APPEAL_DETAIL_STATE.value / 7);
  return regions.map((region, i) => ({
    label: region,
    value: Math.round(baseValue * (1.2 - i * 0.12)),
    color: ['#57b8ff', '#4de0d4', '#8b9bff', '#ffb561', '#ff6b6b', '#51cf66', '#ffd43b'][i],
  }));
}

function generateTrendData() {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月'];
  const baseValue = Math.max(Math.round(APPEAL_DETAIL_STATE.value / 6), 1);
  const multipliers = [0.72, 0.84, 0.93, 1.08, 0.96, 1.15];
  return months.map((month, i) => ({
    label: month,
    value: Math.max(Math.round(baseValue * multipliers[i]), 1),
  }));
}

function generateUnitData() {
  const units = ['城管局', '市场监管局', '住建局', '环保局', '交通局'];
  const total = APPEAL_DETAIL_STATE.value;
  const percentages = [28, 22, 18, 15, 17];
  return units.map((unit, i) => ({
    label: unit,
    value: Math.round(total * percentages[i] / 100),
    percent: percentages[i],
    color: ['#57b8ff', '#4de0d4', '#8b9bff', '#ffb561', '#ff6b6b'][i],
  }));
}

function generateAreaData() {
  const areas = ['天河区', '越秀区', '海珠区', '番禺区', '白云区'];
  const baseValue = Math.round(APPEAL_DETAIL_STATE.value / 5);
  return areas.map((area, i) => ({
    label: area,
    value: Math.round(baseValue * (1 - i * 0.18)),
  }));
}

function renderAppealDetailBarChart(container, data) {
  const width = 320;
  const height = 200;
  const baselineY = height - 24;
  const chartHeight = height - 40;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slotWidth = width / data.length;
  const barWidth = Math.min(slotWidth * 0.5, 32);

  const bars = data.map((item, i) => {
    const x = slotWidth * i + (slotWidth - barWidth) / 2;
    const barHeight = (item.value / max) * chartHeight;
    const y = baselineY - barHeight;
    return `
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="4" fill="${item.color}"/>
      <text x="${(x + barWidth / 2).toFixed(2)}" y="${height - 6}" fill="rgba(152,188,208,0.8)" font-size="11" text-anchor="middle">${item.label}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" style="width:100%;height:100%;">
      ${bars}
    </svg>
  `;
}

function renderAppealDetailLineChart(container, data) {
  const width = 320;
  const height = 200;
  const baselineY = height - 24;
  const chartHeight = height - 40;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slotWidth = width / data.length;
  const gradientId = nextChartId('detail-line-fill');

  const points = data.map((d, i) => {
    const x = slotWidth * i + slotWidth / 2;
    const y = baselineY - (d.value / max) * chartHeight;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const areaD = `${pathD} L ${width} ${baselineY} L 0 ${baselineY} Z`;

  const dots = points.map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="4" fill="#57b8ff"/>`).join('');
  const labels = data.map((d, i) => {
    const x = slotWidth * i + slotWidth / 2;
    return `<text x="${x.toFixed(2)}" y="${height - 6}" fill="rgba(152,188,208,0.8)" font-size="11" text-anchor="middle">${d.label}</text>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" style="width:100%;height:100%;">
      <defs>
        <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(87, 184, 255, 0.35)"/>
          <stop offset="100%" stop-color="rgba(87, 184, 255, 0.02)"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#${gradientId})"/>
      <path d="${pathD}" fill="none" stroke="#57b8ff" stroke-width="2.5" stroke-linecap="round"/>
      ${dots}
      ${labels}
    </svg>
  `;
}

function renderAppealDetailPieChart(container, data) {
  const width = 320;
  const height = 200;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 20;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  let startAngle = -90;

  const slices = data.map((item) => {
    const angle = (item.value / total) * 360;
    const endAngle = startAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;

    const x1 = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
    const y1 = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
    const x2 = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
    const y2 = centerY + radius * Math.sin((endAngle * Math.PI) / 180);

    const path = `M ${centerX} ${centerY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    startAngle = endAngle;

    return `<path d="${path}" fill="${item.color}"/>`;
  }).join('');

  // 图例
  const legend = data.map((item, i) => {
    const lx = 10 + (i % 3) * 105;
    const ly = height - 20;
    return `
      <rect x="${lx}" y="${ly - 8}" width="10" height="10" rx="2" fill="${item.color}"/>
      <text x="${lx + 14}" y="${ly}" fill="rgba(152,188,208,0.8)" font-size="10">${item.label}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" style="width:100%;height:100%;">
      ${slices}
      <circle cx="${centerX}" cy="${centerY}" r="${radius * 0.45}" fill="rgba(8,20,36,0.95)"/>
      <text x="${centerX}" y="${centerY + 5}" fill="var(--dt-text-emphasis)" font-size="14" font-weight="600" text-anchor="middle">${total.toLocaleString()}</text>
      ${legend}
    </svg>
  `;
}

function renderAppealDetailHorizontalBarChart(container, data) {
  const width = 320;
  const height = 200;
  const max = Math.max(...data.map((d) => d.value), 1);
  const rowHeight = (height - 20) / data.length;
  const barGap = 6;
  const labelWidth = 112;

  const bars = data.map((item, i) => {
    const y = i * rowHeight + barGap;
    const barHeight = rowHeight - barGap * 2;
    const barWidth = ((item.value / max) * (width - labelWidth - 50));
    const x = labelWidth;

    return `
      <text x="8" y="${y + barHeight / 2 + 4}" fill="rgba(152,188,208,0.8)" font-size="11">${item.label}</text>
      <rect x="${x}" y="${y}" width="${Math.max(barWidth, 0).toFixed(2)}" height="${barHeight.toFixed(2)}" rx="3" fill="rgba(87,184,255,0.75)"/>
      <text x="${x + Math.max(barWidth, 0) + 8}" y="${y + barHeight / 2 + 4}" fill="var(--dt-text-emphasis)" font-size="11" font-weight="500">${item.value.toLocaleString()}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" style="width:100%;height:100%;">
      ${bars}
    </svg>
  `;
}

function renderSpecialAnalysisAreaChart(container, data) {
  const width = 320;
  const height = 200;
  const max = Math.max(...data.map((d) => d.value), 1);
  const rowHeight = (height - 20) / data.length;
  const barGap = 6;
  const labelWidth = 112;

  const rows = data.map((item, i) => {
    const y = i * rowHeight + barGap;
    const barHeight = rowHeight - barGap * 2;
    const barWidth = ((item.value / max) * (width - labelWidth - 50));
    const x = labelWidth;
    return `
      <g class="special-analysis-area-row" data-special-area-label="${item.label}">
        <text x="8" y="${y + barHeight / 2 + 4}" fill="rgba(152,188,208,0.8)" font-size="11">${item.label}</text>
        <rect x="${x}" y="${y}" width="${Math.max(barWidth, 0).toFixed(2)}" height="${barHeight.toFixed(2)}" rx="3" fill="rgba(87,184,255,0.75)"/>
        <text x="${x + Math.max(barWidth, 0) + 8}" y="${y + barHeight / 2 + 4}" fill="var(--dt-text-emphasis)" font-size="11" font-weight="500">${item.value.toLocaleString()}</text>
      </g>
    `;
  }).join('');

  const backButton = SPECIAL_ANALYSIS_DETAIL_STATE.areaLevel === 'street'
    ? '<button class="special-analysis-area-back" type="button" data-special-analysis-area-back>返回区级</button>'
    : '';

  container.innerHTML = `
    <div class="special-analysis-area-chart">
      ${backButton}
      <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" style="width:100%;height:100%;">
        ${rows}
      </svg>
      <div class="special-analysis-area-trigger-layer">
        ${data.map((item, i) => {
          const y = i * rowHeight + barGap;
          const barHeight = rowHeight - barGap * 2;
          return `<button class="special-analysis-area-trigger" type="button" data-special-analysis-area="${item.label}" style="left:0;right:0;top:${(y / height) * 100}%;height:${(barHeight / height) * 100}%"></button>`;
        }).join('')}
      </div>
    </div>
  `;
}

function closeWorkbench() {
  WORKBENCH_STATE.isOpen = false;
  closeDetailWorkbench();
  renderWorkbench();
}

function setWorkbenchPage(page) {
  const dataset = getWorkbenchDataset();
  const totalPages = Math.max(Math.ceil(dataset.items.length / WORKBENCH_STATE.pageSize), 1);
  WORKBENCH_STATE.page = Math.min(Math.max(page, 1), totalPages);
  renderWorkbench();
}

function setActiveTopic(topic) {
  activeTopic = topic;
  syncTimeFilterControls(topic);
  twinMapScenes.get('special-analysis')?.setActive(topic === 'special-analysis');

  topicTabs.forEach((tab) => {
    const isActive = tab.dataset.topicTab === topic;
    tab.classList.toggle('status-nav__tab--active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  topicContents.forEach((section) => {
    const contentTopic = section.dataset.topicContent ?? '';
    section.hidden = contentTopic !== topic;
  });

  if (topic === 'province-warning') {
    renderProvinceWarningCards();
    return;
  }

  if (CITY_TOPICS.includes(topic)) {
    window.requestAnimationFrame(() => {
      twinMapScenes.get(topic)?.resize();
      if (topic === 'appeal-map') {
        renderAppealHotItemChart(document.querySelector('[data-appeal-hotitem-tab.biz-hotrank__tab--active]')?.dataset.appealHotitemTab ?? 'level1');
        renderAppealRegionChart(document.querySelector('[data-appeal-region-tab.biz-hotrank__tab--active]')?.dataset.appealRegionTab ?? 'city');
        renderAppealNewItemChart(document.querySelector('[data-appeal-newitem-tab.biz-hotrank__tab--active]')?.dataset.appealNewitemTab ?? 'level1');
        renderAppealNewRegionChart(document.querySelector('[data-appeal-newregion-tab.biz-hotrank__tab--active]')?.dataset.appealNewregionTab ?? 'city');
      }
      if (topic === 'special-analysis') {
        renderSpecialAnalysisKpiOverlay();
      }
    });
  }
}

function bindTopicTabs() {
  if (!topicTabs.length) return;

  topicTabs.forEach((tab) => {
    tab.setAttribute('role', 'tab');
    const isActive = tab.classList.contains('status-nav__tab--active');
    tab.setAttribute('aria-selected', String(isActive));
  });

  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-topic-tab]');
    if (!tab) return;
    setActiveTopic(tab.dataset.topicTab ?? '');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const tab = event.target.closest('[data-topic-tab]');
    if (!tab) return;
    event.preventDefault();
    setActiveTopic(tab.dataset.topicTab ?? '');
  });

  const activeTab = topicTabs.find((tab) => tab.classList.contains('status-nav__tab--active'));
  setActiveTopic(activeTab?.dataset.topicTab ?? 'city-stats');
}

function bindBreadcrumbBack() {
  document.addEventListener('click', (event) => {
    const backBtn = event.target.closest('[data-breadcrumb-back]');
    if (!backBtn) return;
    const topic = backBtn.closest('[data-topic-content]')?.dataset.topicContent ?? '';
    if (CITY_TOPICS.includes(topic)) {
      drillbackToProvince(topic);
    }
  });
}

function bindWorkbenchTriggers() {
  document.addEventListener('click', (event) => {
    const bottleneckCloseButton = event.target.closest('[data-bottleneck-close]');
    if (bottleneckCloseButton) {
      closeBottleneckPanel();
      return;
    }

    const bottleneckDeptTrigger = event.target.closest('[data-bottleneck-dept]');
    if (bottleneckDeptTrigger) {
      BOTTLENECK_PANEL_STATE.activeDept = bottleneckDeptTrigger.dataset.bottleneckDept ?? '';
      renderBottleneckPanel();
      return;
    }

    const bottleneckTrigger = event.target.closest('[data-bottleneck-trigger]');
    if (bottleneckTrigger) {
      openBottleneckPanel(bottleneckTrigger.dataset.bottleneckTrigger ?? '');
      return;
    }

    const specialAnalysisAreaBackButton = event.target.closest('[data-special-analysis-area-back]');
    if (specialAnalysisAreaBackButton) {
      SPECIAL_ANALYSIS_DETAIL_STATE.areaLevel = 'district';
      SPECIAL_ANALYSIS_DETAIL_STATE.activeDistrict = '';
      renderSpecialAnalysisDetailPanel();
      return;
    }

    const specialAnalysisAreaTrigger = event.target.closest('[data-special-analysis-area]');
    if (specialAnalysisAreaTrigger) {
      if (SPECIAL_ANALYSIS_DETAIL_STATE.areaLevel === 'district') {
        SPECIAL_ANALYSIS_DETAIL_STATE.areaLevel = 'street';
        SPECIAL_ANALYSIS_DETAIL_STATE.activeDistrict = specialAnalysisAreaTrigger.dataset.specialAnalysisArea ?? '';
        renderSpecialAnalysisDetailPanel();
      }
      return;
    }

    const specialAnalysisDetailCloseButton = event.target.closest('[data-special-analysis-detail-close]');
    if (specialAnalysisDetailCloseButton) {
      closeSpecialAnalysisDetailPanel();
      return;
    }

    const specialAnalysisOrdersCloseButton = event.target.closest('[data-special-analysis-orders-close]');
    if (specialAnalysisOrdersCloseButton) {
      closeSpecialAnalysisOrdersPanel();
      return;
    }

    const specialAnalysisTicketDetailCloseButton = event.target.closest('[data-special-analysis-ticket-detail-close]');
    if (specialAnalysisTicketDetailCloseButton) {
      closeSpecialAnalysisTicketDetailPanel();
      return;
    }

    const specialAnalysisTicketCloseButton = event.target.closest('[data-special-analysis-ticket-close]');
    if (specialAnalysisTicketCloseButton) {
      closeSpecialAnalysisTicketPanel();
      return;
    }

    const specialAnalysisPanelCloseButton = event.target.closest('[data-special-analysis-panel-close]');
    if (specialAnalysisPanelCloseButton) {
      closeSpecialAnalysisPanel();
      return;
    }

    const cityPanelCloseButton = event.target.closest('[data-city-panel-close]');
    if (cityPanelCloseButton) {
      const topic = cityPanelCloseButton.closest('[data-topic-content]')?.dataset.topicContent ?? getActiveCityTopic();
      closeCityPanel(topic);
      return;
    }

    const appealDetailCloseButton = event.target.closest('[data-appeal-detail-close]');
    if (appealDetailCloseButton) {
      closeAppealDetailPanel();
      return;
    }

    const ordersCloseButton = event.target.closest('[data-orders-workbench-close]');
    if (ordersCloseButton) {
      const topic = ordersCloseButton.closest('[data-topic-content]')?.dataset.topicContent ?? getActiveCityTopic();
      closeOrdersWorkbench(topic);
      return;
    }

    const ordersJump = event.target.closest('[data-orders-jump]');
    if (ordersJump) {
      openWorkbenchFromOrdersJump(ordersJump.dataset.ordersJump, ordersJump.dataset.ordersValue ?? '');
      return;
    }

    const ordersTrigger = event.target.closest('[data-orders-workbench-trigger]');
    if (ordersTrigger) {
      const topic = ordersTrigger.closest('[data-topic-content]')?.dataset.topicContent ?? getActiveCityTopic();
      openOrdersWorkbench(topic);
      return;
    }

    const detailCloseButton = event.target.closest('[data-detail-close]');
    if (detailCloseButton) {
      closeDetailWorkbench();
      return;
    }

    const closeButton = event.target.closest('[data-workbench-close]');
    if (closeButton) {
      closeWorkbench();
      return;
    }

    const detailTrigger = event.target.closest('[data-detail-trigger]');
    if (detailTrigger) {
      openDetailWorkbench(detailTrigger.dataset.detailTrigger);
      return;
    }

    const pageButton = event.target.closest('[data-workbench-page]');
    if (pageButton) {
      setWorkbenchPage(Number(pageButton.dataset.workbenchPage));
      return;
    }

    const pageNavButton = event.target.closest('[data-workbench-page-nav]');
    if (pageNavButton) {
      setWorkbenchPage(WORKBENCH_STATE.page + (pageNavButton.dataset.workbenchPageNav === 'next' ? 1 : -1));
      return;
    }

    const specialAnalysisItem = event.target.closest('[data-special-analysis-item]');
    if (specialAnalysisItem) {
      openSpecialAnalysisDetailPanel(specialAnalysisItem.dataset.specialAnalysisItem ?? '');
      return;
    }

    const specialAnalysisPerformanceTrigger = event.target.closest('[data-special-analysis-performance-trigger]');
    if (specialAnalysisPerformanceTrigger) {
      openSpecialAnalysisOrdersPanel('performance', specialAnalysisPerformanceTrigger.dataset.specialAnalysisPerformanceTrigger ?? '');
      return;
    }

    const specialAnalysisTicketItemTrigger = event.target.closest('[data-special-analysis-ticket-item]');
    if (specialAnalysisTicketItemTrigger) {
      openSpecialAnalysisTicketDetailPanel(specialAnalysisTicketItemTrigger.dataset.specialAnalysisTicketItem ?? '');
      return;
    }

    const specialAnalysisTicketTrigger = event.target.closest('[data-special-analysis-ticket-trigger]');
    if (specialAnalysisTicketTrigger) {
      openSpecialAnalysisTicketPanel(specialAnalysisTicketTrigger.dataset.specialAnalysisTicketTrigger ?? '');
      return;
    }

    const specialAnalysisOrdersTrigger = event.target.closest('[data-special-analysis-orders-trigger]');
    if (specialAnalysisOrdersTrigger) {
      const activeUnit = specialAnalysisOrdersTrigger.dataset.specialAnalysisOrdersUnit ?? specialAnalysisOrdersTrigger.closest('[data-special-analysis-warning-unit]')?.dataset.specialAnalysisWarningUnit ?? '';
      const activeFocus = specialAnalysisOrdersTrigger.dataset.specialAnalysisOrdersTrigger === 'kpi-unit-ranking'
        ? specialAnalysisOrdersTrigger.dataset.specialAnalysisKpiTrigger ?? ''
        : '';
      openSpecialAnalysisOrdersPanel(specialAnalysisOrdersTrigger.dataset.specialAnalysisOrdersTrigger ?? '', activeUnit, activeFocus);
      return;
    }

    const specialAnalysisOrdersUnitTrigger = event.target.closest('[data-special-analysis-orders-unit]');
    if (specialAnalysisOrdersUnitTrigger) {
      openSpecialAnalysisOrdersPanel('unit-dispatch', specialAnalysisOrdersUnitTrigger.dataset.specialAnalysisOrdersUnit ?? '');
      return;
    }

    const specialAnalysisOrdersFocusTrigger = event.target.closest('[data-special-analysis-orders-focus]');
    if (specialAnalysisOrdersFocusTrigger) {
      SPECIAL_ANALYSIS_ORDERS_STATE.activeFocus = specialAnalysisOrdersFocusTrigger.dataset.specialAnalysisOrdersFocus ?? '';
      renderSpecialAnalysisOrdersPanel();
      return;
    }

    const specialAnalysisOrdersDeptTrigger = event.target.closest('[data-special-analysis-orders-dept]');
    if (specialAnalysisOrdersDeptTrigger) {
      SPECIAL_ANALYSIS_ORDERS_STATE.activeDept = specialAnalysisOrdersDeptTrigger.dataset.specialAnalysisOrdersDept ?? '';
      renderSpecialAnalysisOrdersPanel();
      return;
    }

    const trigger = event.target.closest('[data-workbench-trigger]');
    if (!trigger) return;
    if (trigger.dataset.workbenchTrigger === 'special-analysis-items') {
      openSpecialAnalysisPanel();
      return;
    }
    openWorkbench(trigger.dataset.workbenchTrigger, trigger.dataset.workbenchArea ?? '');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (DETAIL_WORKBENCH_STATE.isOpen) {
        closeDetailWorkbench();
        return;
      }
      if (WORKBENCH_STATE.isOpen) {
        closeWorkbench();
        return;
      }
      const activeCityTopic = getActiveCityTopic();
      if (getOrdersWorkbenchState(activeCityTopic).isOpen) {
        closeOrdersWorkbench(activeCityTopic);
        return;
      }
      if (getCityPanelState(activeCityTopic).isOpen) {
        closeCityPanel(activeCityTopic);
        return;
      }
    }

    if (event.key !== 'Enter' && event.key !== ' ') return;
    const trigger = event.target.closest('[data-bottleneck-dept], [data-bottleneck-trigger], [data-bottleneck-close], [data-special-analysis-item], [data-special-analysis-area], [data-special-analysis-area-back], [data-special-analysis-detail-close], [data-special-analysis-orders-trigger], [data-special-analysis-orders-unit], [data-special-analysis-orders-focus], [data-special-analysis-orders-dept], [data-special-analysis-orders-close], [data-special-analysis-performance-trigger], [data-special-analysis-ticket-trigger], [data-special-analysis-ticket-item], [data-special-analysis-ticket-close], [data-special-analysis-ticket-detail-close], [data-special-analysis-panel-close], [data-city-panel-close], [data-orders-workbench-trigger], [data-orders-workbench-close], [data-orders-jump], [data-workbench-trigger], [data-workbench-close], [data-workbench-page], [data-workbench-page-nav], [data-detail-trigger], [data-detail-close]');
    if (!trigger) return;
    event.preventDefault();
    trigger.click();
  });
}

function renderBusinessCharts() {
  chartUid = 0;
  document.querySelectorAll('[data-chart="sparkline"]').forEach((node) => renderSparkline(node, BUSINESS_DATA.overview.trend));
  document.querySelectorAll('[data-chart="trend"]').forEach((node) => renderTrendChart(node, BUSINESS_DATA.hotlineTrend.trend24h));
  document.querySelectorAll('[data-chart="flow-trend"]').forEach((node) => renderTrendChart(node, BUSINESS_DATA.hotlineTrend.flowTrend));
  document.querySelectorAll('[data-chart="severity"]').forEach((node) => renderSeverityBar(node, BUSINESS_DATA.riskSummary.severity));
}

function initBusinessCards() {
  renderBusinessCharts();
  renderAppealHotItemChart('level1');
  renderAppealRegionChart('city');
  renderAppealNewItemChart('level1');
  renderAppealNewRegionChart('city');
  Object.keys(TIME_FILTER_STATE).forEach((topic) => syncTimeFilterControls(topic));
  CITY_TOPICS.forEach((topic) => {
    renderBasicInfoStats(topic);
    getScopedTopicElements(topic, '[data-overview-stats]').forEach((container) => {
      renderStatGrid(container, BUSINESS_DATA.overview.stats);
    });
    getScopedTopicElements(topic, '[data-flow-summary]').forEach((container) => {
      renderStatGrid(container, BUSINESS_DATA.flowSummary.map((item) => ({ ...item, compact: true })));
    });
    renderDistributionChart(topic);
    renderRankSummary(topic);
    renderRankList(topic);
    getScopedTopicElements(topic, '[data-flow-list]').forEach((container) => {
      renderFlowList(container, BUSINESS_DATA.workorderFlow, 3);
    });
    renderOrdersWorkbench(topic);
    renderCityPanel(topic);
    if (topic === 'special-analysis') {
      renderSpecialAnalysisKpiOverlay();
    }
  });
  renderProvinceWarningCards();
  renderWorkbench();
  renderDetailWorkbench();
  animateCounts(document);
}

function getTopicViewport(topic) {
  return document.querySelector(`.viewport-scene[data-map-topic="${topic}"]`);
}

async function initTwinMapScenes() {
  const startTasks = CITY_TOPICS.map(async (topic) => {
    const viewport = getTopicViewport(topic);
    if (!viewport) return;

    const SceneClass = topic === 'city-stats' ? TwinMapSceneCityStats : topic === 'appeal-map' ? TwinMapSceneAppealMap : TwinMapSceneSpecialAnalysis;
    const sceneOptions = topic === 'city-stats'
      ? { onRegionSelect: (region) => openCityPanel(region?.name ?? '', topic) }
      : topic === 'appeal-map'
        ? { drilldownOnSelect: true, onRegionSelect: (region) => drilldownToCity(region, topic) }
        : {};

    const scene = new SceneClass(viewport, sceneOptions);
    twinMapScenes.set(topic, scene);

    try {
      await scene.start();
    } catch (error) {
      console.warn(`地图场景 ${topic} 启动失败:`, error);
    }
  });

  await Promise.all(startTasks);
}

async function init() {
  updateStageScale();
  updateClock();
  window.setInterval(updateClock, 1000);

  particleField?.start();
  await initTwinMapScenes();
  bindTopicTabs();
  bindWorkbenchTriggers();
  bindBreadcrumbBack();
  bindAppealHotItemTabs();
  bindAppealRegionTabs();
  bindAppealNewItemTabs();
  bindAppealNewRegionTabs();
  bindTimeFilters();
  initBusinessCards();
  window.addEventListener('resize', handleResize);
}

init().catch((error) => {
  window.__initError = {
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  };
  console.error(error);
});
