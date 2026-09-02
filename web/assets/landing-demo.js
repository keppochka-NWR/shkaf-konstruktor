/* Живой рендер демо-прихожей на лендинге: тот же движок, что в редакторе. */
(function () {
  "use strict";
  var demo = {
    v: 2, name: "Прихожая", room: { w: 2600, h: 2500 }, depth: 600, plinthH: 80,
    back: "lhdf", bodyDecor: "Дуб Вотан", facadeDecor: "Тэффи", upperY: 2000, markup: 2.2,
    modules: [
      { id: "d1", kind: "base", w: 500, h: 2000, depth: null,
        items: [
          { id: "i1", type: "drawers", y: 0, count: 3, boxH: 150, slide: "ball" },
          { id: "i2", type: "shelf_fixed", y: 608 },
          { id: "i3", type: "shelf_adj", y: 992 },
          { id: "i4", type: "shelf_adj", y: 1344 },
        ],
        facade: { system: "hinge", doors: 1, side: "left", opening: "handle",
                  handleId: "lm86471252", decor: null } },
      { id: "d2", kind: "base", w: 900, h: 2000, depth: null,
        items: [
          { id: "i5", type: "rod", y: 1700 },
          { id: "i6", type: "shelf_fixed", y: 1550 },
          { id: "i7", type: "mesh", y: 100, meshId: "lm91587994" },
        ],
        facade: { system: "hinge", doors: 2, side: "left", opening: "handle",
                  handleId: "lm86471252", decor: null } },
      { id: "d3", kind: "base", w: 450, h: 2000, depth: 450,
        items: [
          { id: "i8", type: "shelf_adj", y: 400 },
          { id: "i9", type: "shelf_adj", y: 800 },
          { id: "i10", type: "shelf_adj", y: 1200 },
          { id: "i11", type: "shelf_adj", y: 1600 },
        ],
        facade: { system: "none", doors: 2, side: "left", opening: "handle",
                  handleId: null, decor: null } },
      { id: "d4", kind: "upper", w: 500, h: 400, depth: null, items: [],
        facade: { system: "hinge", doors: 1, side: "left", opening: "push",
                  handleId: null, decor: null } },
      { id: "d5", kind: "upper", w: 900, h: 400, depth: null, items: [],
        facade: { system: "hinge", doors: 2, side: "left", opening: "push",
                  handleId: null, decor: null } },
    ],
  };
  var svg = document.getElementById("landingDemo");
  if (svg) renderProject(svg, demo, null, { showFacades: true, view: "front" });
})();
