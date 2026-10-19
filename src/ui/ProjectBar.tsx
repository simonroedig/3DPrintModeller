import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Copy, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useStore } from "../store/store";
import {
  deleteProject,
  duplicateProject,
  renameProject,
  setProjectBarOpen,
  switchProject,
  useProjects,
  type ProjectMeta,
} from "../store/projects";
import { locale, t } from "../i18n";

function ago(time: number, now: number) {
  const s = Math.max(0, (now - time) / 1000);
  if (s < 45) return t("just now");
  if (s < 3600) return t("{n} min ago", { n: Math.round(s / 60) });
  if (s < 86400) return t("{n} h ago", { n: Math.round(s / 3600) });
  if (s < 2 * 86400) return t("yesterday");
  return new Date(time).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

const newProject = () => useStore.setState({ startDialog: true });

/** collapsible strip at the bottom: all projects with preview, switch / create / rename / copy / delete */
export function ProjectBar() {
  const { list, current, open, ready } = useProjects();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!ready) return null;
  const cur = list.find((p) => p.id === current);
  return (
    <section className="shrink-0 bg-ink-900 border-t border-ink-750">
      <div className="h-9 flex items-center gap-2 px-3">
        <button
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400 hover:text-ink-100"
          title={open ? t("Collapse project list") : t("Expand project list")}
          onClick={() => setProjectBarOpen(!open)}
        >
          <FolderOpen size={14} /> {t("Projects")}
          <span className="normal-case tracking-normal text-ink-500">{list.length}</span>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        {cur && (
          <>
            <span className="text-ink-600">/</span>
            <NameEdit project={cur} className="text-[12.5px] font-medium text-ink-100" />
            <span className="text-[11px] text-ink-500">
              {t(cur.bodies === 1 ? "{n} body · saved {when}" : "{n} bodies · saved {when}", { n: cur.bodies, when: ago(cur.updated, now) })}
            </span>
          </>
        )}
        <div className="flex-1" />
        <button className="btn ghost !h-7" title={t("Create a new project, the current one stays saved")} onClick={newProject}>
          <Plus size={15} /> {t("New")}
        </button>
      </div>
      {open && (
        <div className="project-strip flex gap-2.5 px-3 pb-3 overflow-x-auto scroll-thin">
          <button className="project-card project-new" title={t("Create a new project")} onClick={newProject}>
            <Plus size={22} />
            <span>{t("New project")}</span>
          </button>
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} active={p.id === current} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectCard({ project, active, now }: { project: ProjectMeta; active: boolean; now: number }) {
  return (
    <div
      className={`project-card group ${active ? "active" : ""}`}
      onClick={() => switchProject(project.id)}
    >
      <div className="project-thumb">
        {project.thumb ? <img src={project.thumb} alt="" draggable={false} /> : <span className="text-ink-600 text-[11px]">{t("no preview")}</span>}
        <div className="project-actions" onClick={(e) => e.stopPropagation()}>
          <button title={t("Duplicate")} onClick={() => duplicateProject(project.id)}>
            <Copy size={13} />
          </button>
          <button title={t("Delete")} className="danger" onClick={() => deleteProject(project.id)}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="px-2 pt-1.5 pb-2 min-w-0">
        <NameEdit project={project} className="text-[12px] font-medium text-ink-100 block truncate" />
        <div className="text-[10.5px] text-ink-500 truncate">
          {t(project.bodies === 1 ? "{n} body · {when}" : "{n} bodies · {when}", { n: project.bodies, when: ago(project.updated, now) })}
        </div>
      </div>
    </div>
  );
}

/** name that turns into an input on double click */
function NameEdit({ project, className }: { project: ProjectMeta; className: string }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <input
        className="project-name-input"
        autoFocus
        defaultValue={project.name}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={(e) => {
          renameProject(project.id, e.currentTarget.value);
          setEditing(false);
        }}
      />
    );
  return (
    <span
      className={`${className} cursor-text`}
      title={t("Double-click to rename")}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {project.name}
    </span>
  );
}
