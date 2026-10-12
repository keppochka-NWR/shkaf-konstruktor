import { useMemo, useState } from "react";
import { Scene } from "./Scene";
import { RoomPlan } from "./RoomPlan";
import { RoomEditor } from "./RoomEditor";
import { RoomFixtures } from "./RoomFixtures";
import { RoomObstacles } from "./RoomObstacles";
import {
  RoomObjectProperties,
  type EnvironmentSelection,
} from "./RoomObjectProperties";
import { newProject, type Project, type Room } from "./project";
export function EmptyRoomView({
  project,
  update,
  viewKey,
}: {
  project: Project;
  update: (p: Project) => boolean;
  viewKey: string;
}) {
  const dummy = useMemo(() => newProject().modules[0], []),
    [plan, setPlan] = useState(false),
    [selected, setSelected] = useState<EnvironmentSelection | null>(null);
  const change = (room: Room) => update({ ...project, room });
  const pick = (kind: EnvironmentSelection["kind"], id: string) =>
    setSelected({ kind, id });
  return (
    <section className="empty-room-editor">
      <div>
        <button onClick={() => setPlan(!plan)}>
          {plan ? "Показать 3D комнаты" : "Показать план комнаты"}
        </button>
        <p>Параметры объекта — правая кнопка мыши или кнопка в списке.</p>
        <details>
          <summary>Двери и окна</summary>
          <RoomEditor
            room={project.room}
            part="openings"
            onSelect={(id) => pick("opening", id)}
            onChange={change}
          />
        </details>
        <details>
          <summary>Трубы, радиаторы и объекты на стенах</summary>
          <RoomFixtures
            room={project.room}
            onSelect={(id) => pick("fixture", id)}
            onChange={change}
            onImport={(r) => change(r.room)}
          />
        </details>
        <details>
          <summary>Колонны и отдельные препятствия</summary>
          <RoomObstacles
            room={project.room}
            onSelect={(id) => pick("obstacle", id)}
            onChange={change}
          />
        </details>
      </div>
      <div className="empty-room-canvas">
        {plan ? (
          <RoomPlan
            project={project}
            active=""
            moveAll={false}
            snapping={false}
            onSelect={() => {}}
            onRoom={() => {}}
            onObstacleSelect={(id) => pick("obstacle", id)}
            onOpeningSelect={(id) => pick("opening", id)}
            onFixtureSelect={(id) => pick("fixture", id)}
            onEnvironmentContext={pick}
            update={update}
          />
        ) : (
          <Scene
            viewKey={viewKey}
            module={dummy.module}
            arrangement={[dummy]}
            activeId={dummy.id}
            hideFurniture
            room={project.room}
            captureReady={() => {}}
            mode="orbit"
            moveAll={false}
            snap={(_, p) => p}
            onMoveModule={() => false}
            moveProblem={() => undefined}
            onMoveDivider={() => false}
            dividerProblem={() => undefined}
            partProblem={() => undefined}
            onMovePart={() => false}
            onDropItem={() => false}
            onTransfer={() => false}
            onObstacleSelect={(id) => pick("obstacle", id)}
            onFixtureSelect={(id) => pick("fixture", id)}
            onEnvironmentContext={pick}
            transparent={false}
            onModuleSelect={() => {}}
            onDimension={() => {}}
            onGap={() => {}}
            onPartSelect={() => {}}
            selected=""
            onSelect={() => {}}
            view="iso"
            fit={0}
            openDoors={false}
            exploded={false}
            dimensions={false}
            roomDimensions
          />
        )}
      </div>
      {selected && (
        <RoomObjectProperties
          room={project.room}
          selection={selected}
          onChange={change}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
