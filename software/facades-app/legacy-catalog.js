// Derived from existing local Claude catalogs; prices intentionally excluded.
(function(root){
  const catalog = {
  "legacySnapshot": "2026-11-21",
  "legacyNote": "Перенос каталога из прежних локальных калькуляторов Claude. Старые цены и коэффициенты не включены. Цвета экрана условные; действительность паспортов у поставщика не проверена.",
  "paintMillings": [
    {
      "id": "none",
      "code": "—",
      "name": "Без фрезеровки",
      "desc": "Гладкий фасад",
      "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 60 40\" width=\"60\" height=\"40\"><rect x=\"2\" y=\"2\" width=\"56\" height=\"36\" fill=\"#f6f1e7\" stroke=\"#999\" stroke-width=\".6\"/></svg>",
      "specs": null,
      "thicknesses": [
        16,
        19
      ],
      "limits": {
        "solid": [
          100,
          2750,
          96,
          1170
        ],
        "glass": [
          100,
          2750,
          96,
          1170
        ]
      },
      "source": "Claude Calc/fasad-mdf/data/fasad-mdf-data.js (2026.05.05)"
    },
    {
      "id": "volna",
      "code": "№1",
      "name": "Волна",
      "desc": "Округлые вертикальные волны, шаг 32 мм, глубина 4 мм",
      "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 60 40\" width=\"60\" height=\"40\"><rect x=\"2\" y=\"2\" width=\"56\" height=\"36\" fill=\"#dcd2bf\" stroke=\"#999\" stroke-width=\".5\"/><g><rect x=\"2\" y=\"2\" width=\"8\" height=\"36\" fill=\"#f0e7d0\"/><rect x=\"18\" y=\"2\" width=\"8\" height=\"36\" fill=\"#f0e7d0\"/><rect x=\"34\" y=\"2\" width=\"8\" height=\"36\" fill=\"#f0e7d0\"/><rect x=\"50\" y=\"2\" width=\"8\" height=\"36\" fill=\"#f0e7d0\"/></g><rect x=\"2\" y=\"2\" width=\"56\" height=\"36\" fill=\"none\" stroke=\"#999\" stroke-width=\".5\"/></svg>",
      "specs": {
        "thickness": 19,
        "step": 32,
        "depth": 4,
        "facadeProfile": "R28",
        "edgeProfile": "№011",
        "frameWidth": 64,
        "limits": {
          "solid": {
            "minW": 100,
            "maxW": 1170,
            "minH": 100,
            "maxH": 2750
          },
          "vitrine": {
            "minW": 196,
            "maxW": 1170,
            "minH": 196,
            "maxH": 2750
          }
        },
        "stdWidths": {
          "from": 100,
          "to": 1156,
          "step": 32
        }
      },
      "thicknesses": [
        19
      ],
      "limits": {
        "solid": [
          100,
          2750,
          100,
          1170
        ],
        "glass": [
          196,
          2750,
          196,
          1170
        ]
      },
      "source": "Claude Calc/fasad-mdf/data/fasad-mdf-data.js (2026.05.05)"
    },
    {
      "id": "pryamaya",
      "code": "№4-12",
      "name": "Прямая",
      "desc": "Узкие V-канавки (вельвет), шаг 12.5 мм, V90",
      "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 60 40\" width=\"60\" height=\"40\"><rect x=\"2\" y=\"2\" width=\"56\" height=\"36\" fill=\"#f0e7d0\" stroke=\"#999\" stroke-width=\".5\"/><g stroke=\"#888\" stroke-width=\".4\" opacity=\".75\"><line x1=\"6\" y1=\"3\" x2=\"6\" y2=\"37\"/><line x1=\"9.5\" y1=\"3\" x2=\"9.5\" y2=\"37\"/><line x1=\"13\" y1=\"3\" x2=\"13\" y2=\"37\"/><line x1=\"16.5\" y1=\"3\" x2=\"16.5\" y2=\"37\"/><line x1=\"20\" y1=\"3\" x2=\"20\" y2=\"37\"/><line x1=\"23.5\" y1=\"3\" x2=\"23.5\" y2=\"37\"/><line x1=\"27\" y1=\"3\" x2=\"27\" y2=\"37\"/><line x1=\"30.5\" y1=\"3\" x2=\"30.5\" y2=\"37\"/><line x1=\"34\" y1=\"3\" x2=\"34\" y2=\"37\"/><line x1=\"37.5\" y1=\"3\" x2=\"37.5\" y2=\"37\"/><line x1=\"41\" y1=\"3\" x2=\"41\" y2=\"37\"/><line x1=\"44.5\" y1=\"3\" x2=\"44.5\" y2=\"37\"/><line x1=\"48\" y1=\"3\" x2=\"48\" y2=\"37\"/><line x1=\"51.5\" y1=\"3\" x2=\"51.5\" y2=\"37\"/><line x1=\"55\" y1=\"3\" x2=\"55\" y2=\"37\"/></g></svg>",
      "specs": {
        "thickness": 16,
        "step": 12.5,
        "depth": 3,
        "facadeProfile": "V90",
        "edgeProfile": "Ф3",
        "frameWidth": 73,
        "limits": {
          "solid": {
            "minW": 96,
            "maxW": 1170,
            "minH": 100,
            "maxH": 2750
          },
          "vitrine": {
            "minW": 196,
            "maxW": 1170,
            "minH": 196,
            "maxH": 2750
          }
        },
        "stdWidths": {
          "from": 96,
          "to": 1146,
          "step": 50
        }
      },
      "thicknesses": [
        16
      ],
      "limits": {
        "solid": [
          100,
          2750,
          96,
          1170
        ],
        "glass": [
          196,
          2750,
          196,
          1170
        ]
      },
      "source": "Claude Calc/fasad-mdf/data/fasad-mdf-data.js (2026.05.05)"
    },
    {
      "id": "type3",
      "code": "№7",
      "name": "Тип 3 (рейка)",
      "desc": "Прямоугольные рейки, шаг 25 мм, глубина 3 мм",
      "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 60 40\" width=\"60\" height=\"40\"><rect x=\"2\" y=\"2\" width=\"56\" height=\"36\" fill=\"#f0e7d0\" stroke=\"#999\" stroke-width=\".5\"/><g fill=\"#888\" opacity=\".55\"><rect x=\"6\" y=\"2\" width=\"2\" height=\"36\"/><rect x=\"13\" y=\"2\" width=\"2\" height=\"36\"/><rect x=\"20\" y=\"2\" width=\"2\" height=\"36\"/><rect x=\"27\" y=\"2\" width=\"2\" height=\"36\"/><rect x=\"34\" y=\"2\" width=\"2\" height=\"36\"/><rect x=\"41\" y=\"2\" width=\"2\" height=\"36\"/><rect x=\"48\" y=\"2\" width=\"2\" height=\"36\"/><rect x=\"55\" y=\"2\" width=\"2\" height=\"36\"/></g></svg>",
      "specs": {
        "thickness": 16,
        "step": 25,
        "depth": 3,
        "facadeProfile": "D12",
        "edgeProfile": "№011",
        "frameWidth": 64,
        "limits": {
          "solid": {
            "minW": 96,
            "maxW": 1170,
            "minH": 100,
            "maxH": 2750
          },
          "vitrine": {
            "minW": 196,
            "maxW": 1170,
            "minH": 196,
            "maxH": 2750
          }
        },
        "stdWidths": {
          "from": 96,
          "to": 1146,
          "step": 50
        }
      },
      "thicknesses": [
        16
      ],
      "limits": {
        "solid": [
          100,
          2750,
          96,
          1170
        ],
        "glass": [
          196,
          2750,
          196,
          1170
        ]
      },
      "source": "Claude Calc/fasad-mdf/data/fasad-mdf-data.js (2026.05.05)"
    }
  ],
  "paintColors": [
    {
      "id": "9001",
      "code": "9001",
      "name": "Кремово-белый",
      "hex": "#FDF4E3",
      "group": "whites"
    },
    {
      "id": "9002",
      "code": "9002",
      "name": "Серо-белый",
      "hex": "#E7EBDA",
      "group": "whites"
    },
    {
      "id": "9003",
      "code": "9003",
      "name": "Сигнальный белый",
      "hex": "#F4F4F4",
      "group": "whites"
    },
    {
      "id": "9010",
      "code": "9010",
      "name": "Белый",
      "hex": "#FFFFFF",
      "group": "whites"
    },
    {
      "id": "9016",
      "code": "9016",
      "name": "Транспортный белый",
      "hex": "#F1F0EA",
      "group": "whites"
    },
    {
      "id": "7035",
      "code": "7035",
      "name": "Светло-серый",
      "hex": "#CBCFC4",
      "group": "greys"
    },
    {
      "id": "7044",
      "code": "7044",
      "name": "Шёлково-серый",
      "hex": "#CAC4B0",
      "group": "greys"
    },
    {
      "id": "7038",
      "code": "7038",
      "name": "Агатовый серый",
      "hex": "#B5B8B1",
      "group": "greys"
    },
    {
      "id": "7037",
      "code": "7037",
      "name": "Пыльно-серый",
      "hex": "#7D7F7D",
      "group": "greys"
    },
    {
      "id": "7016",
      "code": "7016",
      "name": "Антрацитово-серый",
      "hex": "#293133",
      "group": "greys"
    },
    {
      "id": "7022",
      "code": "7022",
      "name": "Серый умбра",
      "hex": "#332F2C",
      "group": "greys"
    },
    {
      "id": "7045",
      "code": "7045",
      "name": "Телегрей 1",
      "hex": "#90969C",
      "group": "greys"
    },
    {
      "id": "7042",
      "code": "7042",
      "name": "Серый дорожный А",
      "hex": "#8F9695",
      "group": "greys"
    },
    {
      "id": "9005",
      "code": "9005",
      "name": "Чёрный янтарный",
      "hex": "#0A0A0A",
      "group": "blacks"
    },
    {
      "id": "9011",
      "code": "9011",
      "name": "Графитово-чёрный",
      "hex": "#1C1C1C",
      "group": "blacks"
    },
    {
      "id": "9017",
      "code": "9017",
      "name": "Транспортный чёрный",
      "hex": "#1E1E1E",
      "group": "blacks"
    },
    {
      "id": "1013",
      "code": "1013",
      "name": "Жемчужно-белый",
      "hex": "#EAE6CA",
      "group": "beiges"
    },
    {
      "id": "1014",
      "code": "1014",
      "name": "Слоновая кость",
      "hex": "#DFCEA1",
      "group": "beiges"
    },
    {
      "id": "1015",
      "code": "1015",
      "name": "Светлая слоновая кость",
      "hex": "#EADEBD",
      "group": "beiges"
    },
    {
      "id": "1019",
      "code": "1019",
      "name": "Серо-бежевый",
      "hex": "#A48F7A",
      "group": "beiges",
      "aliases": [
        "Кашемир"
      ]
    },
    {
      "id": "1024",
      "code": "1024",
      "name": "Жёлтая охра",
      "hex": "#BAA04B",
      "group": "beiges"
    },
    {
      "id": "8001",
      "code": "8001",
      "name": "Охра коричневая",
      "hex": "#9D622B",
      "group": "browns"
    },
    {
      "id": "8002",
      "code": "8002",
      "name": "Сигнальный коричневый",
      "hex": "#8E402A",
      "group": "browns"
    },
    {
      "id": "8003",
      "code": "8003",
      "name": "Глиняный коричневый",
      "hex": "#7B5141",
      "group": "browns"
    },
    {
      "id": "8011",
      "code": "8011",
      "name": "Коричневый орех",
      "hex": "#5A3A29",
      "group": "browns"
    },
    {
      "id": "8014",
      "code": "8014",
      "name": "Сепия коричневый",
      "hex": "#4A3526",
      "group": "browns"
    },
    {
      "id": "8017",
      "code": "8017",
      "name": "Шоколадный",
      "hex": "#45322E",
      "group": "browns"
    },
    {
      "id": "8019",
      "code": "8019",
      "name": "Серо-коричневый",
      "hex": "#3F3A3A",
      "group": "browns"
    },
    {
      "id": "8022",
      "code": "8022",
      "name": "Чёрно-коричневый",
      "hex": "#1A1A1A",
      "group": "browns"
    },
    {
      "id": "3003",
      "code": "3003",
      "name": "Рубиново-красный",
      "hex": "#9B111E",
      "group": "reds"
    },
    {
      "id": "3004",
      "code": "3004",
      "name": "Пурпурно-красный",
      "hex": "#75151E",
      "group": "reds"
    },
    {
      "id": "3005",
      "code": "3005",
      "name": "Винно-красный",
      "hex": "#5E2129",
      "group": "reds"
    },
    {
      "id": "3007",
      "code": "3007",
      "name": "Чёрно-красный",
      "hex": "#412227",
      "group": "reds"
    },
    {
      "id": "5002",
      "code": "5002",
      "name": "Ультрамарин",
      "hex": "#1E2160",
      "group": "blues"
    },
    {
      "id": "5003",
      "code": "5003",
      "name": "Сапфирово-синий",
      "hex": "#1D334A",
      "group": "blues"
    },
    {
      "id": "5008",
      "code": "5008",
      "name": "Серо-синий",
      "hex": "#26323A",
      "group": "blues"
    },
    {
      "id": "5011",
      "code": "5011",
      "name": "Стальной синий",
      "hex": "#1A2C3E",
      "group": "blues"
    },
    {
      "id": "5014",
      "code": "5014",
      "name": "Голубино-синий",
      "hex": "#637D96",
      "group": "blues"
    },
    {
      "id": "6005",
      "code": "6005",
      "name": "Зелёный мох",
      "hex": "#114232",
      "group": "greens"
    },
    {
      "id": "6009",
      "code": "6009",
      "name": "Пихтовый зелёный",
      "hex": "#27352A",
      "group": "greens"
    },
    {
      "id": "6011",
      "code": "6011",
      "name": "Резедово-зелёный",
      "hex": "#587246",
      "group": "greens"
    },
    {
      "id": "6021",
      "code": "6021",
      "name": "Бледно-зелёный",
      "hex": "#89AC76",
      "group": "greens"
    }
  ],
  "paintColorGroups": {
    "whites": "Белые",
    "greys": "Серые",
    "blacks": "Чёрные",
    "beiges": "Бежевые",
    "browns": "Коричневые",
    "reds": "Красные",
    "blues": "Синие",
    "greens": "Зелёные"
  },
  "paintFinishes": [
    {
      "id": "matte",
      "name": "Матовое",
      "desc": "Стандартное матовое покрытие"
    },
    {
      "id": "glossy",
      "name": "Глянцевое",
      "desc": "Глянцевое покрытие"
    },
    {
      "id": "soft-touch",
      "name": "Soft-touch",
      "desc": "Бархатистое тактильное покрытие"
    }
  ],
  "aluProfiles": [
    {
      "id": "F1-09",
      "name": "F1-09 (Стандарт)",
      "thickness": null,
      "frameWidth": null,
      "source": "Claude Calc/fasad-alu/data/fasad-alu-data.js (2026.03.25)"
    },
    {
      "id": "F1-17",
      "name": "F1-17 (Слим)",
      "thickness": null,
      "frameWidth": null,
      "source": "Claude Calc/fasad-alu/data/fasad-alu-data.js (2026.03.25)"
    },
    {
      "id": "F1-19",
      "name": "F1-19 (Премиум)",
      "thickness": null,
      "frameWidth": null,
      "source": "Claude Calc/fasad-alu/data/fasad-alu-data.js (2026.03.25)"
    }
  ],
  "aluColors": [],
  "aluFills": [
    {
      "id": "fill-0",
      "name": "Зеркало Серебро 4мм",
      "group": "Зеркала",
      "mat": "mat-mirror",
      "swatch": "linear-gradient(135deg,#bcceda 0%,#ddeef6 18%,#aac4d2 38%,#d5eaf4 56%,#a4bec8 76%,#c4d9e6 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-1",
      "name": "Зеркало Серебро 6мм",
      "group": "Зеркала",
      "mat": "mat-mirror",
      "swatch": "linear-gradient(135deg,#bcceda 0%,#ddeef6 18%,#aac4d2 38%,#d5eaf4 56%,#a4bec8 76%,#c4d9e6 100%)",
      "thickness": 6,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-2",
      "name": "Зеркало Бронза 4мм",
      "group": "Зеркала",
      "mat": "mat-bronze-mirror",
      "swatch": "linear-gradient(135deg,#be8658 0%,#d29e6e 25%,#a67046 50%,#c88e5e 75%,#986040 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-3",
      "name": "Зеркало Графит 4мм",
      "group": "Зеркала",
      "mat": "mat-graphite-mirror",
      "swatch": "linear-gradient(135deg,#565c64 0%,#72788a 25%,#464c54 50%,#62687a 75%,#3a4048 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-4",
      "name": "Зеркало серебро (зелёная амальгама)",
      "group": "Зеркала",
      "mat": "mat-mirror",
      "swatch": "linear-gradient(135deg,#bcceda 0%,#ddeef6 18%,#aac4d2 38%,#d5eaf4 56%,#a4bec8 76%,#c4d9e6 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-5",
      "name": "Зеркало Crystalvision 4мм",
      "group": "Зеркала",
      "mat": "mat-mirror",
      "swatch": "linear-gradient(135deg,#bcceda 0%,#ddeef6 18%,#aac4d2 38%,#d5eaf4 56%,#a4bec8 76%,#c4d9e6 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-6",
      "name": "Зеркало Crystalvision 6мм",
      "group": "Зеркала",
      "mat": "mat-mirror",
      "swatch": "linear-gradient(135deg,#bcceda 0%,#ddeef6 18%,#aac4d2 38%,#d5eaf4 56%,#a4bec8 76%,#c4d9e6 100%)",
      "thickness": 6,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-7",
      "name": "Стекло прозрачное 4мм",
      "group": "Стекло",
      "mat": "mat-glass",
      "swatch": "linear-gradient(135deg,rgba(178,214,234,.72) 0%,rgba(222,242,252,.8) 28%,rgba(155,200,224,.65) 58%,rgba(202,232,248,.76) 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-8",
      "name": "Стекло прозрачное 5мм",
      "group": "Стекло",
      "mat": "mat-glass",
      "swatch": "linear-gradient(135deg,rgba(178,214,234,.72) 0%,rgba(222,242,252,.8) 28%,rgba(155,200,224,.65) 58%,rgba(202,232,248,.76) 100%)",
      "thickness": 5,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-9",
      "name": "Стекло прозрачное 6мм",
      "group": "Стекло",
      "mat": "mat-glass",
      "swatch": "linear-gradient(135deg,rgba(178,214,234,.72) 0%,rgba(222,242,252,.8) 28%,rgba(155,200,224,.65) 58%,rgba(202,232,248,.76) 100%)",
      "thickness": 6,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-10",
      "name": "Стекло просветлённое Crystalvision",
      "group": "Стекло",
      "mat": "mat-glass",
      "swatch": "linear-gradient(135deg,rgba(178,214,234,.72) 0%,rgba(222,242,252,.8) 28%,rgba(155,200,224,.65) 58%,rgba(202,232,248,.76) 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-11",
      "name": "Стекло тонированное Бронза 4мм",
      "group": "Стекло",
      "mat": "mat-tinted",
      "swatch": "linear-gradient(135deg,rgba(68,80,62,.62) 0%,rgba(90,106,80,.72) 40%,rgba(52,63,48,.66) 70%,rgba(80,95,72,.62) 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-12",
      "name": "Стекло тонированное Графит 4мм",
      "group": "Стекло",
      "mat": "mat-graphite-mirror",
      "swatch": "linear-gradient(135deg,#565c64 0%,#72788a 25%,#464c54 50%,#62687a 75%,#3a4048 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-13",
      "name": "Стекло сатин матовый 4мм",
      "group": "Стекло",
      "mat": "mat-satin",
      "swatch": "linear-gradient(135deg,rgba(202,210,217,.88) 0%,rgba(226,233,240,.92) 28%,rgba(184,196,206,.82) 58%,rgba(214,224,232,.88) 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-14",
      "name": "Стекло сатин матовый 5мм",
      "group": "Стекло",
      "mat": "mat-satin",
      "swatch": "linear-gradient(135deg,rgba(202,210,217,.88) 0%,rgba(226,233,240,.92) 28%,rgba(184,196,206,.82) 58%,rgba(214,224,232,.88) 100%)",
      "thickness": 5,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-15",
      "name": "Стекло сатин графит",
      "group": "Стекло",
      "mat": "mat-graphite-mirror",
      "swatch": "linear-gradient(135deg,#565c64 0%,#72788a 25%,#464c54 50%,#62687a 75%,#3a4048 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-16",
      "name": "Стекло сатин бронзовый",
      "group": "Стекло",
      "mat": "mat-bronze-mirror",
      "swatch": "linear-gradient(135deg,#be8658 0%,#d29e6e 25%,#a67046 50%,#c88e5e 75%,#986040 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-17",
      "name": "Кризет б/ц",
      "group": "Узорчатые (склад)",
      "mat": "mat-glass",
      "swatch": "linear-gradient(135deg,rgba(178,214,234,.72) 0%,rgba(222,242,252,.8) 28%,rgba(155,200,224,.65) 58%,rgba(202,232,248,.76) 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-18",
      "name": "Данди / Паве / Диамант б/ц",
      "group": "Узорчатые (склад)",
      "mat": "mat-satin",
      "swatch": "linear-gradient(135deg,rgba(202,210,217,.88) 0%,rgba(226,233,240,.92) 28%,rgba(184,196,206,.82) 58%,rgba(214,224,232,.88) 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-19",
      "name": "Зеркало Серебро: Магнолия / Гармония / Гиза",
      "group": "Узорчатые (склад)",
      "mat": "mat-mirror",
      "swatch": "linear-gradient(135deg,#bcceda 0%,#ddeef6 18%,#aac4d2 38%,#d5eaf4 56%,#a4bec8 76%,#c4d9e6 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-20",
      "name": "Зеркало Бронза: Уади",
      "group": "Узорчатые (склад)",
      "mat": "mat-bronze-mirror",
      "swatch": "linear-gradient(135deg,#be8658 0%,#d29e6e 25%,#a67046 50%,#c88e5e 75%,#986040 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-21",
      "name": "Стекло Фуджи чёрный",
      "group": "Узорчатые (склад)",
      "mat": "mat-dark-glass",
      "swatch": "linear-gradient(135deg,#2a2d35 0%,#3a3f4d 25%,#222530 50%,#32374a 75%,#1e2028 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-22",
      "name": "Стекло Штукатурка чёрный",
      "group": "Узорчатые (склад)",
      "mat": "mat-dark-glass",
      "swatch": "linear-gradient(135deg,#2a2d35 0%,#3a3f4d 25%,#222530 50%,#32374a 75%,#1e2028 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-23",
      "name": "Стекло Богема",
      "group": "Узорчатые (склад)",
      "mat": "mat-satin",
      "swatch": "linear-gradient(135deg,rgba(202,210,217,.88) 0%,rgba(226,233,240,.92) 28%,rgba(184,196,206,.82) 58%,rgba(214,224,232,.88) 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-24",
      "name": "Стекло Феникс бесцвет 4мм",
      "group": "Узорчатые (склад)",
      "mat": "mat-glass",
      "swatch": "linear-gradient(135deg,rgba(178,214,234,.72) 0%,rgba(222,242,252,.8) 28%,rgba(155,200,224,.65) 58%,rgba(202,232,248,.76) 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-25",
      "name": "Стекло Феникс Бронза / Грей",
      "group": "Узорчатые (склад)",
      "mat": "mat-tinted",
      "swatch": "linear-gradient(135deg,rgba(68,80,62,.62) 0%,rgba(90,106,80,.72) 40%,rgba(52,63,48,.66) 70%,rgba(80,95,72,.62) 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-26",
      "name": "Дарк Грей 4мм",
      "group": "Узорчатые (склад)",
      "mat": "mat-dark-glass",
      "swatch": "linear-gradient(135deg,#2a2d35 0%,#3a3f4d 25%,#222530 50%,#32374a 75%,#1e2028 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-27",
      "name": "Мору (Флутис)",
      "group": "Узорчатые (склад)",
      "mat": "mat-satin",
      "swatch": "linear-gradient(135deg,rgba(202,210,217,.88) 0%,rgba(226,233,240,.92) 28%,rgba(184,196,206,.82) 58%,rgba(214,224,232,.88) 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-28",
      "name": "Мору бронза / графит",
      "group": "Узорчатые (склад)",
      "mat": "mat-bronze-mirror",
      "swatch": "linear-gradient(135deg,#be8658 0%,#d29e6e 25%,#a67046 50%,#c88e5e 75%,#986040 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-29",
      "name": "Рифлёное Б/Ц: Найл",
      "group": "Узорчатые (заказные)",
      "mat": "mat-glass",
      "swatch": "linear-gradient(135deg,rgba(178,214,234,.72) 0%,rgba(222,242,252,.8) 28%,rgba(155,200,224,.65) 58%,rgba(202,232,248,.76) 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-30",
      "name": "Рифлёное Бронза: Аква / Найл / Ниагара",
      "group": "Узорчатые (заказные)",
      "mat": "mat-bronze-mirror",
      "swatch": "linear-gradient(135deg,#be8658 0%,#d29e6e 25%,#a67046 50%,#c88e5e 75%,#986040 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-31",
      "name": "Hithicross бесцветное 4мм",
      "group": "Узорчатые (заказные)",
      "mat": "mat-glass",
      "swatch": "linear-gradient(135deg,rgba(178,214,234,.72) 0%,rgba(222,242,252,.8) 28%,rgba(155,200,224,.65) 58%,rgba(202,232,248,.76) 100%)",
      "thickness": 4,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-32",
      "name": "Узорчатое Б/Ц (Терновник, Вулкан и др)",
      "group": "Узорчатые (заказные)",
      "mat": "mat-satin",
      "swatch": "linear-gradient(135deg,rgba(202,210,217,.88) 0%,rgba(226,233,240,.92) 28%,rgba(184,196,206,.82) 58%,rgba(214,224,232,.88) 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-33",
      "name": "Узорчатое Бронза (Паве, Лабиринт и др)",
      "group": "Узорчатые (заказные)",
      "mat": "mat-bronze-mirror",
      "swatch": "linear-gradient(135deg,#be8658 0%,#d29e6e 25%,#a67046 50%,#c88e5e 75%,#986040 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-34",
      "name": "Зеркало Серебро: Лабиринт",
      "group": "Узорчатые (заказные)",
      "mat": "mat-mirror",
      "swatch": "linear-gradient(135deg,#bcceda 0%,#ddeef6 18%,#aac4d2 38%,#d5eaf4 56%,#a4bec8 76%,#c4d9e6 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-35",
      "name": "Зеркало Бронза: Лабиринт",
      "group": "Узорчатые (заказные)",
      "mat": "mat-bronze-mirror",
      "swatch": "linear-gradient(135deg,#be8658 0%,#d29e6e 25%,#a67046 50%,#c88e5e 75%,#986040 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-36",
      "name": "Зеркало серебро матовое",
      "group": "Узорчатые (заказные)",
      "mat": "mat-mirror",
      "swatch": "linear-gradient(135deg,#bcceda 0%,#ddeef6 18%,#aac4d2 38%,#d5eaf4 56%,#a4bec8 76%,#c4d9e6 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-37",
      "name": "Лакобель 9003 — белый (просветл. ст.)",
      "group": "Лакобель",
      "mat": "mat-lacobel-white",
      "swatch": "linear-gradient(155deg,#efefef 0%,#fbfbfb 35%,#e8e8e8 65%,#f5f5f5 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-38",
      "name": "Лакобель 9010 — белый (обычн. ст.)",
      "group": "Лакобель",
      "mat": "mat-lacobel-white",
      "swatch": "linear-gradient(155deg,#efefef 0%,#fbfbfb 35%,#e8e8e8 65%,#f5f5f5 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-39",
      "name": "Лакобель 9005 — чёрный",
      "group": "Лакобель",
      "mat": "mat-lacobel-black",
      "swatch": "linear-gradient(155deg,#252525 0%,#353535 35%,#1c1c1c 65%,#2a2a2a 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-40",
      "name": "Лакобель 1013 — светло-бежевый",
      "group": "Лакобель",
      "mat": "mat-ldsp-wood",
      "swatch": "linear-gradient(155deg,#c2a06e 0%,#ceb07e 25%,#b68e5c 50%,#c6a676 75%,#b68e5c 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-41",
      "name": "Лакобель 1015 — бежевый",
      "group": "Лакобель",
      "mat": "mat-ldsp-wood",
      "swatch": "linear-gradient(155deg,#c2a06e 0%,#ceb07e 25%,#b68e5c 50%,#c6a676 75%,#b68e5c 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-42",
      "name": "Лакобель 7035 — серый",
      "group": "Лакобель",
      "mat": "mat-satin",
      "swatch": "linear-gradient(135deg,rgba(202,210,217,.88) 0%,rgba(226,233,240,.92) 28%,rgba(184,196,206,.82) 58%,rgba(214,224,232,.88) 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    },
    {
      "id": "fill-43",
      "name": "Лакобель 1236 — светло-коричневый",
      "group": "Лакобель",
      "mat": "mat-ldsp-wood",
      "swatch": "linear-gradient(155deg,#c2a06e 0%,#ceb07e 25%,#b68e5c 50%,#c6a676 75%,#b68e5c 100%)",
      "thickness": null,
      "source": "Claude Calc/fasad-alu/data/fillings.js (2025.09.16)"
    }
  ]
};
  const retail=typeof module==='object'&&module.exports ? require('./retail-film.js') : root.facadeFilmRetail;
  catalog.paintMillings.push(...retail.enamelPatterns);
  if(typeof module==='object'&&module.exports) module.exports=catalog;
  root.FACADE_LEGACY=catalog;
  if(root.FACADE_CATALOG) Object.assign(root.FACADE_CATALOG,catalog);
})(typeof window!=='undefined'?window:globalThis);
