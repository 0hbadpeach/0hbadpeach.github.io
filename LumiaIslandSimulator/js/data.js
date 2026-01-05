// js/data.js

// 규칙
window.SIM_RULES = {
  maxTeams: 8,
  teamSize: 3,
  maxDays: 7,
  turnsPerDay: 6,

  // 부활
  autoReviveDays: 2,      // 1~2일차 자동부활 가능
  reviveCost: 200,        // 3일차부터 1명 부활 비용
};

// 역할/무기(표시용)
window.ROLE_LIST = ["전사","탱커","스킬 딜러","원거리 딜러","암살자","지원가"];
window.WEAPON_LIST = [
  "글러브","톤파","방망이","망치","채찍","투척","암기","활","석궁","권총","돌격 소총","저격총",
  "도끼","단검","양손검","쌍검","창","쌍절곤","레이피어","기타(악기)","카메라","아르카나","VF 의수"
];

// 지도 지역(박스형)
window.ZONES = [
  "골목길","주유소","양궁장",
  "학교","호텔","모래사장",
  "고급 주택가","창고","항구",
  "공장","병원","개울",
  "절","경찰서","연못",
  "성당","숲","소방서",
  "묘지","연구소"
];

// --- 공식 실험체 목록 ---
// ✅ 여기(OFFICIAL_CHARACTERS)에 너가 정리한 배열을 그대로 붙여넣으면 됨.
// 아래는 예시 + 기본 3명(아야/재키/현우)만 넣어둠.
// (너는 “재키/아야/현우 제외” 리스트를 줬으니까, 아래 3명은 취향대로 유지/삭제하면 됨)
window.OFFICIAL_CHARACTERS = [
  { id:"official:aya", codename:"14M-RFT11", name:"아야", roles:["스킬 딜러","원거리 딜러"], weaponChoices:["권총","돌격 소총","저격총"] },
  { id:"official:jackie", codename:"14M-RFT01", name:"재키", roles:["전사","암살자"], weaponChoices:["단검","쌍검","도끼"] },
  { id:"official:hyunwoo", codename:"14M-RFT04", name:"현우", roles:["전사"], weaponChoices:["글러브","톤파"] },
  { id:"official:magnus", codename:"15M-RFT18",   name:"매그너스", roles:["탱커","전사"], weaponChoices:["망치","방망이"] },
  { id:"official:fiora", codename:"14M-RFT02",   name:"피오라", roles:["전사"], weaponChoices:["레이피어","양손검","창"] },
  { id:"official:nadine", codename:"14M-RFT10",   name:"나딘", roles:["스킬 딜러","원거리 딜러"], weaponChoices:["활","석궁"] },
  { id:"official:zahir", codename:"14M-RFT03",   name:"자히르", roles:["스킬 딜러"], weaponChoices:["투척","암기"] },
  { id:"official:hart", codename:"16M-RFT22", name:"하트", roles:["원거리 딜러"], weaponChoices:["기타(악기)"] },
  { id:"official:isol", codename:"16M-RFT16",   name:"아이솔", roles:["스킬 딜러","원거리 딜러"], weaponChoices:["돌격 소총","권총"] },
  { id:"official:lidailin", codename:"16M-RFT20",   name:"리 다이린", roles:["전사"], weaponChoices:["글러브","쌍절곤"] },
  { id:"official:yuki", codename:"17M-RFT31",   name:"유키", roles:["전사"], weaponChoices:["양손검","쌍검"] },
  { id:"official:hyejin", codename:"14M-RFT12",   name:"혜진", roles:["스킬 딜러"], weaponChoices:["활","암기"] },
  { id:"official:xiukai", codename:"14M-RFT09",   name:"쇼우", roles:["탱커"], weaponChoices:["창","단검"] },
  { id:"official:sissela", codename:"17M-RFT27",   name:"시셀라", roles:["스킬 딜러"], weaponChoices:["암기","투척"] },
  { id:"official:chiara", codename:"16M-RFT21",   name:"키아라", roles:["전사"], weaponChoices:["레이피어"] },
  { id:"official:adriana", codename:"17M-RFT29",   name:"아드리아나", roles:["스킬 딜러"], weaponChoices:["투척"] },
  { id:"official:shoichi", codename:"16M-RFT23",   name:"쇼이치", roles:["암살자"], weaponChoices:["단검"] },
  { id:"official:silvia", codename:"16M-RFT19",   name:"실비아", roles:["전사","스킬 딜러"], weaponChoices:["권총"] },
  { id:"official:emma", codename:"18M-RFT38",   name:"엠마", roles:["스킬 딜러"], weaponChoices:["암기","아르카나"] },
  { id:"official:lenox", codename:"17M-RFT32",   name:"레녹스", roles:["탱커"], weaponChoices:["채찍"] },
  { id:"official:rozzi", codename:"18M-RFT37",   name:"로지", roles:["원거리 딜러"], weaponChoices:["권총"] },
  { id:"official:luke", codename:"18M-RFT36",   name:"루크", roles:["전사"], weaponChoices:["방망이"] },
  { id:"official:cathy", codename:"14M-RFT14",   name:"캐시", roles:["암살자"], weaponChoices:["단검","쌍검"] },
  { id:"official:adela", codename:"17M-RFT28",   name:"아델라", roles:["스킬 딜러"], weaponChoices:["레이피어","방망이"] },
  { id:"official:bernice", codename:"16M-RFT26",   name:"버니스", roles:["원거리 딜러"], weaponChoices:["저격총"] },
  { id:"official:barbara", codename:"16M-RFT15",   name:"바바라", roles:["스킬 딜러"], weaponChoices:["권총"] },
  { id:"official:alex", codename:"14M-RFT13",   name:"알렉스", roles:["전사"], weaponChoices:["톤파","양손검","암기","권총"] },
  { id:"official:sua", codename:"17M-RFT33",   name:"수아", roles:["전사","스킬 딜러"], weaponChoices:["망치","방망이"] },
  { id:"official:leon", codename:"15M-RFT17",   name:"레온", roles:["전사"], weaponChoices:["글러브","톤파"] },
  { id:"official:eleven", codename:"19M-RFT39",   name:"일레븐", roles:["탱커"], weaponChoices:["망치"] },
  { id:"official:rio", codename:"19M-RFT41",   name:"리오", roles:["원거리 딜러"], weaponChoices:["활"] },
  { id:"official:william", codename:"14M-RFT05",   name:"윌리엄", roles:["원거리 딜러"], weaponChoices:["투척"] },
  { id:"official:nicky", codename:"20M-RFT43",   name:"니키", roles:["전사"], weaponChoices:["글러브"] },
  { id:"official:nathapon", codename:"17M-RFT30",   name:"나타폰", roles:["스킬 딜러"], weaponChoices:["카메라"] },
  { id:"official:jan", codename:"18M-RFT35",   name:"얀", roles:["전사"], weaponChoices:["글러브","톤파"] },
  { id:"official:eva", codename:"02M-RFT42",   name:"이바", roles:["스킬 딜러"], weaponChoices:["투척"] },
  { id:"official:daniel", codename:"19M-RFT40",   name:"다니엘", roles:["암살자"], weaponChoices:["단검"] },
  { id:"official:jenny", codename:"14M-RFT07",   name:"제니", roles:["원거리 딜러"], weaponChoices:["권총"] },
  { id:"official:camilo", codename:"16M-RFT25",   name:"카밀로", roles:["전사"], weaponChoices:["쌍검","레이피어"] },
  { id:"official:chloe", codename:"20M-RFT46",   name:"클로에", roles:["원거리 딜러"], weaponChoices:["암기"] },
  { id:"official:johann", codename:"21M-RFT47",   name:"요한", roles:["지원가"], weaponChoices:["아르카나"] },
  { id:"official:bianca", codename:"20M-RFT45",   name:"비앙카", roles:["스킬 딜러"], weaponChoices:["아르카나"] },
  { id:"official:celine", codename:"21M-RFT48",   name:"셀린", roles:["스킬 딜러"], weaponChoices:["투척"] },
  { id:"official:echion", codename:"14M-RFT44",   name:"에키온", roles:["전사"], weaponChoices:["VF 의수"] },
  { id:"official:mai", codename:"18M-RFT34",   name:"마이", roles:["탱커","지원가"], weaponChoices:["채찍"] },
  { id:"official:aiden", codename:"21M-RFT50",   name:"에이든", roles:["전사"], weaponChoices:["양손검"] },
  { id:"official:laura", codename:"21M-RFT49",   name:"라우라", roles:["전사"], weaponChoices:["채찍"] },
  { id:"official:tia", codename:"21M-RFT51",   name:"띠아", roles:["스킬 딜러"], weaponChoices:["방망이"] },
  { id:"official:felix", codename:"22M-RFT53",   name:"펠릭스", roles:["전사"], weaponChoices:["창"] },
  { id:"official:elena", codename:"22M-RFT52",   name:"엘레나", roles:["탱커"], weaponChoices:["레이피어"] },
  { id:"official:priya", codename:"22M-RFT54",   name:"프리야", roles:["스킬 딜러","지원가"], weaponChoices:["기타(악기)"] },
  { id:"official:adina", codename:"22M-RFT55",   name:"아디나", roles:["스킬 딜러","지원가"], weaponChoices:["아르카나"] },
  { id:"official:markus", codename:"22M-RFT56",   name:"마커스", roles:["탱커","전사"], weaponChoices:["도끼","망치"] },
  { id:"official:karla", codename:"22M-RFT57",   name:"칼라", roles:["원거리 딜러"], weaponChoices:["석궁"] },
  { id:"official:estelle", codename:"22M-RFT58",   name:"에스텔", roles:["탱커","전사"], weaponChoices:["도끼"] },
  { id:"official:piolo", codename:"22M-RFT59",   name:"피올로", roles:["전사"], weaponChoices:["쌍절곤"] },
  { id:"official:martina", codename:"22M-RFT60",   name:"마르티나", roles:["원거리 딜러"], weaponChoices:["카메라"] },
  { id:"official:haze", codename:"22M-RFT61",   name:"헤이즈", roles:["스킬 딜러"], weaponChoices:["돌격 소총"] },
  { id:"official:isaac", codename:"22M-RFT62",   name:"아이작", roles:["전사"], weaponChoices:["톤파"] },
  { id:"official:tazia", codename:"22M-RFT63",   name:"타지아", roles:["스킬 딜러"], weaponChoices:["암기"] },
  { id:"official:irem", codename:"22M-RFT64",   name:"이렘", roles:["전사","스킬 딜러"], weaponChoices:["투척"] },
  { id:"official:theodore", codename:"23M-RFT65",   name:"테오도르", roles:["원거리 딜러","지원가"], weaponChoices:["저격총"] },
  { id:"official:lyanh", codename:"23M-RFT66",   name:"이안", roles:["전사"], weaponChoices:["단검"] },
  { id:"official:vanya", codename:"23M-RFT67",   name:"바냐", roles:["전사"], weaponChoices:["아르카나"] },
  { id:"official:debimarlene", codename:"23M-RFT68, 23M-RFT69",   name:"데비&마를렌", roles:["전사"], weaponChoices:["양손검"] },
  { id:"official:arda", codename:"16M-RFT24",   name:"아르다", roles:["스킬 딜러","지원가"], weaponChoices:["아르카나"] },
  { id:"official:abigail", codename:"23M-RFT70",   name:"아비게일", roles:["전사"], weaponChoices:["도끼"] },
  { id:"official:alonso", codename:"23M-RFT71",   name:"알론소", roles:["탱커"], weaponChoices:["글러브"] },
  { id:"official:leni", codename:"23M-RFT72",   name:"레니", roles:["지원가"], weaponChoices:["권총"] },
  { id:"official:tsubame", codename:"23M-RFT73",   name:"츠바메", roles:["원거리 딜러"], weaponChoices:["암기"] },
  { id:"official:kenneth", codename:"24M-RFT74",   name:"케네스", roles:["전사"], weaponChoices:["도끼"] },
  { id:"official:katja", codename:"24M-RFT75",   name:"카티야", roles:["원거리 딜러"], weaponChoices:["저격총"] },
  { id:"official:charlotte", codename:"24M-RFT76",   name:"샬렛", roles:["지원가"], weaponChoices:["아르카나"] },
  { id:"official:darko", codename:"24M-RFT77",   name:"다르코", roles:["전사"], weaponChoices:["방망이"] },
  { id:"official:lenore", codename:"24M-RFT78",   name:"르노어", roles:["스킬 딜러"], weaponChoices:["기타(악기)"] },
  { id:"official:garnet", codename:"24M-RFT79",   name:"가넷", roles:["탱커","전사"], weaponChoices:["방망이"] },
  { id:"official:yumin", codename:"24M-RFT80",   name:"유민", roles:["스킬 딜러"], weaponChoices:["아르카나"] },
  { id:"official:hisui", codename:"23M-RFT81",   name:"히스이", roles:["전사"], weaponChoices:["양손검"] },
  { id:"official:justyna", codename:"25M-RFT82",   name:"유스티나", roles:["스킬 딜러"], weaponChoices:["석궁"] },
  { id:"official:istvan", codename:"25M-RFT83",   name:"이슈트반", roles:["전사"], weaponChoices:["창"] },
  { id:"official:niah", codename:"25M-RFT84",   name:"니아", roles:["스킬 딜러"], weaponChoices:["권총"] },
  { id:"official:xuelin", codename:"25M-RFT85",   name:"슈린", roles:["전사","암살자"], weaponChoices:["레이피어"] },
  { id:"official:henry", codename:"25M-RFT86",   name:"헨리", roles:["스킬 딜러"], weaponChoices:["암기"] },
  { id:"official:blair", codename:"25M-RFT87",   name:"블레어", roles:["전사"], weaponChoices:["쌍검"] },
  { id:"official:mirka", codename:"25M-RFT88",   name:"미르카", roles:["탱커","전사"], weaponChoices:["망치"] },
];

// (선택) 아주 최소한의 파밍/제작 베이스 데이터
// ✅ 네가 나중에 “재료/제작식”을 JSON으로 붙여넣기 쉽게 해둔 구조
window.MATERIALS = ["재료A","재료B","재료C"];
window.CRAFT_RECIPES = [
  // 예: 3개 재료로 무기티어 상승(간이)
  { id:"upgrade_weapon", inputs:{ "재료A":1, "재료B":1, "재료C":1 }, effect:{ weaponTier:+1 } }
];

// 날씨(공식 설명 기반: 효과는 “시뮬 내부 수치”로만 반영)
window.WEATHER_MAIN = ["흐림","쾌청","비","모래바람"];
window.WEATHER_SUB  = ["무풍","강풍","벼락","안개"];
