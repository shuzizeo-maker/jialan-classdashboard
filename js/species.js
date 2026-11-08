// 山林圖鑑物種資料（以臺東金峰鄉、嘉蘭一帶山林常見或具文化意義的物種為主）
// rarity: 1 普通、2 稀有、3 珍貴
window.SPECIES = [
  // ── 鳥類 ──
  { id: 'b1', cat: 'bird', name: '臺灣藍鵲', emoji: '🐦', rarity: 3, desc: '臺灣特有種，紅嘴、藍身、長長的白尾巴，常一家子成群活動，又叫「長尾山娘」。' },
  { id: 'b2', cat: 'bird', name: '烏頭翁', emoji: '🐤', rarity: 2, desc: '臺灣特有種，主要住在花東地區，頭頂是黑色的，是白頭翁的東部親戚。' },
  { id: 'b3', cat: 'bird', name: '五色鳥', emoji: '🦜', rarity: 2, desc: '身上有綠、藍、黃、紅、黑五種顏色，叫聲「郭、郭、郭」像在敲木魚。' },
  { id: 'b4', cat: 'bird', name: '大冠鷲', emoji: '🦅', rarity: 2, desc: '常在山谷上空盤旋，邊飛邊發出「忽悠－忽悠」的叫聲，喜歡吃蛇。' },
  { id: 'b5', cat: 'bird', name: '藍腹鷴', emoji: '🐓', rarity: 3, desc: '臺灣特有種，雄鳥有寶藍色的身體和紅色臉皮，躲在中低海拔森林裡。' },
  { id: 'b6', cat: 'bird', name: '領角鴞', emoji: '🦉', rarity: 2, desc: '夜行性的小貓頭鷹，晚上會發出「嗚、嗚」的叫聲，專抓老鼠和大昆蟲。' },
  { id: 'b7', cat: 'bird', name: '綠繡眼', emoji: '🐥', rarity: 1, desc: '眼睛外圍有一圈白色，喜歡吃花蜜和果實，常常成群在樹上跳來跳去。' },
  { id: 'b8', cat: 'bird', name: '竹雞', emoji: '🐔', rarity: 1, desc: '躲在草叢裡，叫聲很大聲，聽起來像「雞狗乖、雞狗乖」。' },
  { id: 'b9', cat: 'bird', name: '鉛色水鶇', emoji: '🐦‍⬛', rarity: 2, desc: '住在溪流邊的石頭上，尾巴會一開一合地搖動，常在太麻里溪看見。' },
  { id: 'b10', cat: 'bird', name: '大卷尾', emoji: '🐦‍⬛', rarity: 1, desc: '全身黑色、尾巴分叉，俗稱「烏秋」，很勇敢，敢驅趕老鷹。' },

  // ── 動物 ──
  { id: 'a1', cat: 'animal', name: '臺灣獼猴', emoji: '🐒', rarity: 1, desc: '臺灣唯一的原生猴子，成群生活在山區，會用叫聲互相通知危險。' },
  { id: 'a2', cat: 'animal', name: '山羌', emoji: '🦌', rarity: 2, desc: '臺灣體型最小的鹿，叫聲像狗吠，所以又叫「吠鹿」。' },
  { id: 'a3', cat: 'animal', name: '臺灣黑熊', emoji: '🐻', rarity: 3, desc: '胸前有白色 V 字斑紋，是臺灣最大的陸地哺乳動物，需要大家一起保護。' },
  { id: 'a4', cat: 'animal', name: '百步蛇', emoji: '🐍', rarity: 3, desc: '排灣族的祖靈象徵，常出現在傳統雕刻與服飾上。牠有毒，在野外看到要保持距離。' },
  { id: 'a5', cat: 'animal', name: '赤腹松鼠', emoji: '🐿️', rarity: 1, desc: '肚子是紅褐色的松鼠，很會爬樹，喜歡吃果實和種子。' },
  { id: 'a6', cat: 'animal', name: '臺灣野山羊', emoji: '🐐', rarity: 2, desc: '又叫長鬃山羊，很會在陡峭的山壁跳躍，住在中高海拔山區。' },
  { id: 'a7', cat: 'animal', name: '臺灣野豬', emoji: '🐗', rarity: 2, desc: '鼻子很靈敏，會用嘴巴翻土找食物，是山林裡的力氣大王。' },
  { id: 'a8', cat: 'animal', name: '穿山甲', emoji: '🦔', rarity: 3, desc: '全身披著鱗片，遇到危險會捲成球，用長舌頭吃螞蟻和白蟻。' },
  { id: 'a9', cat: 'animal', name: '莫氏樹蛙', emoji: '🐸', rarity: 2, desc: '臺灣特有種，綠色身體、橘紅色眼睛，叫聲像「呱、呱、呱」。' },
  { id: 'a10', cat: 'animal', name: '斯文豪氏攀蜥', emoji: '🦎', rarity: 1, desc: '常在樹幹或石頭上曬太陽，會點頭示威，是臺灣常見的蜥蜴。' },

  // ── 昆蟲 ──
  { id: 'i1', cat: 'insect', name: '黃裳鳳蝶', emoji: '🦋', rarity: 3, desc: '後翅是亮黃色的大型蝴蝶，是保育類昆蟲，幼蟲吃馬兜鈴。' },
  { id: 'i2', cat: 'insect', name: '大琉璃紋鳳蝶', emoji: '🦋', rarity: 2, desc: '翅膀上有閃亮的藍綠色光澤，飛行很快，喜歡吸食花蜜。' },
  { id: 'i3', cat: 'insect', name: '紫斑蝶', emoji: '🦋', rarity: 2, desc: '冬天會成群飛到南臺灣溫暖的山谷過冬，形成美麗的「紫蝶幽谷」。' },
  { id: 'i4', cat: 'insect', name: '枯葉蝶', emoji: '🍂', rarity: 2, desc: '翅膀合起來像一片枯葉，是偽裝高手。' },
  { id: 'i5', cat: 'insect', name: '獨角仙', emoji: '🪲', rarity: 2, desc: '雄蟲頭上有大大的角，力氣非常大，夏天晚上會被燈光吸引。' },
  { id: 'i6', cat: 'insect', name: '鍬形蟲', emoji: '🪲', rarity: 1, desc: '有一對像大鉗子的大顎，喜歡吸樹液，是很受歡迎的甲蟲。' },
  { id: 'i7', cat: 'insect', name: '螢火蟲', emoji: '✨', rarity: 2, desc: '屁股會發光，只在乾淨的水邊和草叢出現，是環境健康的指標。' },
  { id: 'i8', cat: 'insect', name: '竹節蟲', emoji: '🌿', rarity: 1, desc: '長得像一根樹枝，一動也不動地躲在葉子間。' },
  { id: 'i9', cat: 'insect', name: '熊蟬', emoji: '🦗', rarity: 1, desc: '夏天山上最響亮的歌手，只有雄蟬會鳴叫。' },
  { id: 'i10', cat: 'insect', name: '臺灣大虎頭蜂', emoji: '🐝', rarity: 2, desc: '體型很大的胡蜂，秋天特別敏感，看到蜂巢要安靜遠離。' },

  // ── 植物 ──
  { id: 'p1', cat: 'plant', name: '洛神花', emoji: '🌺', rarity: 2, desc: '金峰鄉的代表作物，秋冬收成，紅色花萼可做成酸甜的洛神花茶和蜜餞。' },
  { id: 'p2', cat: 'plant', name: '小米', emoji: '🌾', rarity: 2, desc: '排灣族重要的傳統作物，小米收穫祭是部落一年中重要的祭儀。' },
  { id: 'p3', cat: 'plant', name: '紅藜', emoji: '🌾', rarity: 2, desc: '排灣族稱為 djulis，穗子有紅、橘、黃等顏色，被稱為「穀類的紅寶石」。' },
  { id: 'p4', cat: 'plant', name: '臺灣百合', emoji: '🌷', rarity: 3, desc: '在排灣族文化中象徵純潔與榮耀，佩戴百合花是一種榮譽。' },
  { id: 'p5', cat: 'plant', name: '山櫻花', emoji: '🌸', rarity: 1, desc: '冬末春初開出粉紅色的花，吸引許多鳥兒來吸花蜜。' },
  { id: 'p6', cat: 'plant', name: '筆筒樹', emoji: '🌴', rarity: 2, desc: '高大的蕨類植物，樹幹上有像花紋的葉痕，是很古老的植物家族。' },
  { id: 'p7', cat: 'plant', name: '刺蔥', emoji: '🌱', rarity: 1, desc: '樹幹長滿尖刺，葉子有特殊香氣，是原住民料理常用的香料。' },
  { id: 'p8', cat: 'plant', name: '姑婆芋', emoji: '🍃', rarity: 1, desc: '葉子大大的很像芋頭，但全株有毒，不能吃！' },
  { id: 'p9', cat: 'plant', name: '楓香', emoji: '🍁', rarity: 1, desc: '秋冬葉子會變紅變黃，葉片有三個尖角，搓一搓有香味。' },
  { id: 'p10', cat: 'plant', name: '臺灣欒樹', emoji: '🌳', rarity: 1, desc: '秋天先開黃花，再結出紅褐色的蒴果，一年有好幾種顏色。' }
];

window.SPECIES_CATS = {
  bird:   { name: '鳥類', color: '#6fb7e6' },
  animal: { name: '動物', color: '#d9a066' },
  insect: { name: '昆蟲', color: '#e6c95a' },
  plant:  { name: '植物', color: '#7fcf8a' }
};
window.RARITY = { 1: '普通', 2: '稀有', 3: '珍貴' };
