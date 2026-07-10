import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  getAcademyCourses, createAcademyCourseV2, updateAcademyCourseV2,
  deleteAcademyCourseV2,
  getChapters, upsertChapter, deleteChapter,
  getLessons, upsertLesson, deleteLesson,
  uploadAcademyFile,
} from "@/lib/api/academy.functions";

// ── Types ──────────────────────────────────────────────────────────────────
type Course = {
  id: string; title: string; description: string;
  cover_image_url?: string; image_url?: string;
  intro_video_url?: string; intro_video_type?: string;
  category: string; level: string; price: number;
  duration_minutes: number; is_published: boolean;
  instructor_name?: string; instructor_title?: string;
  has_certificate: boolean; youtube_id?: string;
  chapter_count: number; lesson_count: number;
  created_at: string;
};
type Chapter = {
  id: string; course_id: string; title: string; description?: string;
  sort_order: number; duration_minutes: number; is_published: boolean;
  lesson_count?: number;
};
type Lesson = {
  id: string; chapter_id: string; title: string;
  content_type: "video"|"text"|"pdf"|"quiz";
  video_url?: string; video_type?: string;
  video_duration_seconds?: number; text_content?: string;
  pdf_url?: string; sort_order: number; is_free_preview: boolean;
};

// ── YouTube helpers ─────────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function ytThumb(id: string) {
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}
function fmtSeconds(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ── Light Theme styles ─────────────────────────────────────────────────────
const inp = "w-full bg-white border border-gray-300 rounded-lg text-gray-900 text-sm px-3 py-2.5 focus:outline-none focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F] placeholder-gray-400 transition shadow-xs";
const lbl = "block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5";

// ══════════════════════════════════════════════════════════════════════════════
// SYLLABUS IMPORT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function SyllabusImportModal({
  onImport,
  onClose,
}: {
  onImport: (titles: string[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportText = () => {
    const lines = text
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);
    if (lines.length === 0) {
      toast.error("Please paste or write some chapter titles first");
      return;
    }
    onImport(lines);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const contents = event.target?.result as string;
      const lines = contents
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
      if (lines.length === 0) {
        toast.error("The uploaded file is empty");
        return;
      }
      onImport(lines);
      toast.success(`Imported ${lines.length} chapters from file!`);
      onClose();
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-[500px] p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="font-bold text-gray-900 text-base" style={{ fontFamily: "Playfair Display,serif" }}>
            Paste or Upload Syllabus Chapters
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl cursor-pointer">✕</button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-gray-500 font-semibold leading-relaxed">
            Paste your chapter titles below (one chapter title per line) or upload a plain text file (.txt).
          </p>

          <textarea
            rows={6}
            className={`${inp} resize-none font-mono text-xs`}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`e.g.\nChapter 1: Intro to Avocado Farming\nChapter 2: Pest Control Methods\nChapter 3: Harvesting & Packing`}
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Or upload a text file:</span>
            <input
              type="file"
              accept=".txt"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-[#2D6A4F] font-bold hover:underline cursor-pointer"
            >
              📂 Select .txt File
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-gray-100 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer hover:bg-gray-300 transition">
            Cancel
          </button>
          <button onClick={handleImportText} className="px-4 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold cursor-pointer hover:bg-[#224f3b] transition">
            Import Chapters
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LESSON MODAL
// ══════════════════════════════════════════════════════════════════════════════
function LessonModal({
  chapterId, lesson, lessonCount, onClose, onSaved,
}: {
  chapterId: string; lesson?: Lesson | null;
  lessonCount: number; onClose: () => void; onSaved: (l: Lesson) => void;
}) {
  const [tab, setTab] = useState<Lesson["content_type"]>(lesson?.content_type ?? "video");
  const [form, setForm] = useState({
    title: lesson?.title ?? "",
    video_url: lesson?.video_url ?? "",
    video_type: (lesson?.video_type ?? "youtube") as "youtube"|"vimeo"|"direct",
    video_duration_seconds: lesson?.video_duration_seconds ?? 0,
    text_content: lesson?.text_content ?? "",
    pdf_url: lesson?.pdf_url ?? "",
    is_free_preview: lesson?.is_free_preview ?? false,
  });
  const [saving, setSaving] = useState(false);
  const ytId = tab === "video" && form.video_type === "youtube" ? extractYouTubeId(form.video_url) : null;

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      const saved = await upsertLesson({ data: {
        ...(lesson?.id ? { id: lesson.id } : {}),
        chapter_id: chapterId,
        title: form.title,
        content_type: tab,
        video_url: form.video_url || undefined,
        video_type: tab === "video" ? form.video_type : undefined,
        video_duration_seconds: tab === "video" ? form.video_duration_seconds : undefined,
        text_content: tab === "text" ? form.text_content : undefined,
        pdf_url: tab === "pdf" ? form.pdf_url : undefined,
        sort_order: lesson?.sort_order ?? lessonCount,
        is_free_preview: form.is_free_preview,
      }});
      onSaved(saved as Lesson);
      toast.success(lesson ? "Lesson updated" : "Lesson added");
    } catch { toast.error("Failed to save lesson"); }
    finally { setSaving(false); }
  };

  const tabs: Lesson["content_type"][] = ["video","text","pdf","quiz"];
  const tabIcon: Record<string,string> = { video: "▶", text: "📄", pdf: "📎", quiz: "✓" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-[560px] max-h-[90vh] overflow-y-auto flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150">
          <span className="font-bold text-gray-900 text-lg" style={{ fontFamily:"Playfair Display,serif" }}>
            {lesson ? "Edit Lesson" : "Add Lesson"}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl cursor-pointer">✕</button>
        </div>

        {/* Content type tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider cursor-pointer transition ${
                tab === t
                  ? "text-[#2D6A4F] border-b-2 border-[#2D6A4F] bg-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}>
              <span className="mr-1.5">{tabIcon[t]}</span> {t}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4 flex-1">
          {/* Title */}
          <div>
            <label className={lbl}>Lesson Title</label>
            <input className={inp} value={form.title}
              onChange={e => setForm(f => ({...f, title: e.target.value}))}
              placeholder="e.g. Introduction to Drip Irrigation" />
          </div>

          {/* VIDEO */}
          {tab === "video" && (
            <>
              <div>
                <label className={lbl}>Video Type</label>
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                  {(["youtube","vimeo","direct"] as const).map(vt => (
                    <button key={vt} onClick={() => setForm(f => ({...f, video_type: vt}))}
                      className={`flex-1 py-1.5 rounded-md text-xs font-bold cursor-pointer transition ${
                        form.video_type === vt
                          ? "bg-[#2D6A4F] text-white shadow-xs"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                      }`}>
                      {vt === "youtube" ? "YouTube" : vt === "vimeo" ? "Vimeo" : "Direct URL"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Video URL</label>
                <div className="flex gap-2">
                  <input className={inp} value={form.video_url}
                    onChange={e => setForm(f => ({...f, video_url: e.target.value}))}
                    placeholder={form.video_type === "youtube" ? "https://youtube.com/watch?v=..." : "https://..."} />
                  <label className="shrink-0 bg-[#2D6A4F] text-white px-3 py-2 text-xs font-bold rounded-lg cursor-pointer hover:bg-[#224f3b] transition flex items-center justify-center">
                    <span>Upload</span>
                    <input type="file" accept="video/*" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = (reader.result as string).split(',')[1];
                          try {
                            toast.loading("Uploading lesson video...", { id: "upload-lesson-video" });
                            const res = await uploadAcademyFile({ data: { fileName: file.name, fileContentBase64: base64 } });
                            setForm(f => ({...f, video_url: res.url, video_type: "direct"}));
                            toast.success("Lesson video uploaded successfully!", { id: "upload-lesson-video" });
                          } catch (err) {
                            toast.error("Failed to upload lesson video", { id: "upload-lesson-video" });
                          }
                        };
                        reader.readAsDataURL(file);
                      }} />
                  </label>
                </div>
              </div>
              {ytId && (
                <div className="rounded-lg overflow-hidden border border-gray-250">
                  <img src={ytThumb(ytId)} alt="preview" className="w-full h-32 object-cover" />
                </div>
              )}
              <div>
                <label className={lbl}>Duration (seconds)</label>
                <input type="number" min={0} className={`${inp} max-w-[160px]`}
                  value={form.video_duration_seconds}
                  onChange={e => setForm(f => ({...f, video_duration_seconds: Number(e.target.value)}))} />
                {form.video_duration_seconds > 0 && (
                  <span className="ml-2 text-gray-500 text-xs">{fmtSeconds(form.video_duration_seconds)}</span>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input type="checkbox" checked={form.is_free_preview}
                  onChange={e => setForm(f => ({...f, is_free_preview: e.target.checked}))}
                  className="accent-[#2D6A4F]" />
                <span className="text-xs text-gray-600">Mark as free preview — learners can watch without enrolling</span>
              </label>
            </>
          )}

          {/* TEXT */}
          {tab === "text" && (
            <div>
              <label className={lbl}>Content (Markdown)</label>
              <textarea rows={8} className={`${inp} resize-none`}
                value={form.text_content}
                onChange={e => setForm(f => ({...f, text_content: e.target.value}))}
                placeholder="Write lesson content in Markdown..." />
              {form.text_content && (
                <p className="text-[10px] text-gray-400 mt-1">
                  ~{Math.ceil(form.text_content.split(/\s+/).filter(Boolean).length / 200)} min read
                </p>
              )}
            </div>
          )}

          {/* PDF */}
          {tab === "pdf" && (
            <div>
              <label className={lbl}>PDF / Document URL</label>
              <div className="flex gap-2">
                <input className={inp} value={form.pdf_url}
                  onChange={e => setForm(f => ({...f, pdf_url: e.target.value}))}
                  placeholder="https://cdn.mqulima.co.ke/docs/... or upload a file" />
                <label className="shrink-0 bg-[#2D6A4F] text-white px-3 py-2 text-xs font-bold rounded-lg cursor-pointer hover:bg-[#224f3b] transition flex items-center justify-center">
                  <span>Upload</span>
                  <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64 = (reader.result as string).split(',')[1];
                        try {
                          toast.loading("Uploading document...", { id: "upload-lesson-pdf" });
                          const res = await uploadAcademyFile({ data: { fileName: file.name, fileContentBase64: base64 } });
                          setForm(f => ({...f, pdf_url: res.url}));
                          toast.success("Document uploaded successfully!", { id: "upload-lesson-pdf" });
                        } catch (err) {
                          toast.error("Failed to upload document", { id: "upload-lesson-pdf" });
                        }
                      };
                      reader.readAsDataURL(file);
                    }} />
                </label>
              </div>
            </div>
          )}

          {/* QUIZ */}
          {tab === "quiz" && (
            <div>
              <label className={lbl}>External Quiz Link (Typeform, Google Forms…)</label>
              <input className={inp} value={form.pdf_url}
                onChange={e => setForm(f => ({...f, pdf_url: e.target.value}))}
                placeholder="https://form.typeform.com/..." />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-150 bg-gray-50">
          <span className="text-xs text-gray-500">
            Lesson {lesson ? "–" : lessonCount + 1} of {lesson ? lessonCount : lessonCount + 1}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer hover:bg-gray-300 transition">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold cursor-pointer hover:bg-[#224f3b] disabled:opacity-60 flex items-center gap-2 transition">
              {saving && <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Save Lesson
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHAPTER ROW
// ══════════════════════════════════════════════════════════════════════════════
function ChapterRow({
  chapter, courseId, idx,
  onUpdated, onDeleted, refreshCourse,
}: {
  chapter: Chapter; courseId: string; idx: number;
  onUpdated: (c: Chapter) => void; onDeleted: (id: string) => void;
  refreshCourse: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(chapter.title);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonModal, setLessonModal] = useState<{open:boolean; lesson:Lesson|null}>({open:false,lesson:null});

  const loadLessons = useCallback(async () => {
    if (!open) return;
    try {
      const data = await getLessons({ data: { chapterId: chapter.id } });
      setLessons(data as unknown as Lesson[]);
    } catch { toast.error("Failed to load lessons"); }
  }, [chapter.id, open]);

  useEffect(() => { loadLessons(); }, [loadLessons]);

  const saveTitle = async () => {
    setEditingTitle(false);
    if (titleVal === chapter.title) return;
    try {
      const updated = await upsertChapter({ data: { id: chapter.id, course_id: courseId, title: titleVal, sort_order: chapter.sort_order } });
      onUpdated(updated as Chapter);
    } catch { toast.error("Failed to save chapter"); setTitleVal(chapter.title); }
  };

  const typeIcon: Record<string,string> = { video: "▶", text: "📄", pdf: "📎", quiz: "✓" };

  return (
    <div className="border border-gray-200 bg-white hover:shadow-xs transition duration-150">
      {/* Chapter header */}
      <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => { setOpen(o => !o); }}>
        <span className="text-gray-400 select-none cursor-grab">⠿⠿</span>
        <span className="text-[10px] font-mono text-[#2D6A4F] font-bold w-6 shrink-0">{String(idx+1).padStart(2,"0")}</span>
        <span className="text-gray-400 text-xs transition-transform duration-200" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>

        {editingTitle ? (
          <input autoFocus className="flex-1 bg-transparent border-b border-[#2D6A4F] text-gray-900 text-sm focus:outline-none"
            value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => e.key === "Enter" && saveTitle()}
            onClick={e => e.stopPropagation()} />
        ) : (
          <div className="flex-1 flex items-center gap-2 min-w-0" onClick={e => e.stopPropagation()}>
            <span className="text-sm font-semibold text-gray-800 truncate">
              {chapter.title}
            </span>
            <button type="button" onClick={() => setEditingTitle(true)} className="text-gray-400 hover:text-[#2D6A4F] p-1 transition rounded hover:bg-gray-100 cursor-pointer" title="Edit chapter title">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}

        <span className="text-[10px] text-gray-400 shrink-0">{chapter.duration_minutes}min</span>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${chapter.is_published ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
          {chapter.is_published ? "Live" : "Draft"}
        </span>
        <button type="button" onClick={async e => { e.stopPropagation(); if (!confirm("Delete chapter?")) return;
          try { await deleteChapter({ data: { chapterId: chapter.id } }); onDeleted(chapter.id); refreshCourse(); }
          catch { toast.error("Failed to delete chapter"); }
        }} className="text-gray-400 hover:text-red-600 text-xs cursor-pointer ml-1 shrink-0">✕</button>
      </div>

      {/* Lessons list */}
      {open && (
        <div className="pl-12 pr-4 pb-3 space-y-1 bg-gray-50/50">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="flex items-center gap-2.5 py-2 px-3 bg-white border border-gray-150 rounded-lg group hover:border-[#2D6A4F] hover:shadow-xs transition duration-150">
              <span className="text-gray-300 text-xs cursor-grab">⠿</span>
              <span className="text-xs text-gray-600" title={lesson.content_type}>{typeIcon[lesson.content_type]}</span>
              <span className="flex-1 text-xs text-gray-700 truncate">{lesson.title}</span>
              {lesson.is_free_preview && (
                <span className="text-[9px] border border-amber-500 text-amber-600 font-bold px-1 rounded-xs">FREE PREVIEW</span>
              )}
              {lesson.video_duration_seconds && lesson.video_duration_seconds > 0 && (
                <span className="text-[10px] text-gray-400 font-mono">{fmtSeconds(lesson.video_duration_seconds)}</span>
              )}
              <button type="button" onClick={() => setLessonModal({open:true, lesson})}
                className="text-[11px] text-[#2D6A4F] font-bold hover:underline cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#2D6A4F]/10 transition">Edit</button>
              <button type="button" onClick={async (e) => {
                e.stopPropagation();
                if (!confirm("Delete lesson?")) return;
                try { await deleteLesson({ data: { lessonId: lesson.id } }); setLessons(ls => ls.filter(l => l.id !== lesson.id)); refreshCourse(); }
                catch { toast.error("Failed to delete lesson"); }
              }} className="text-[11px] text-red-600 font-bold hover:underline cursor-pointer px-1.5 py-0.5 rounded hover:bg-red-50 transition">Delete</button>
            </div>
          ))}
          <button onClick={() => setLessonModal({open:true, lesson:null})}
            className="w-full py-2.5 rounded-lg border border-dashed border-gray-300 text-gray-500 bg-white text-xs hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition cursor-pointer mt-1 font-semibold flex items-center justify-center gap-1">
            <span>+</span> Add Lesson
          </button>
        </div>
      )}

      {lessonModal.open && (
        <LessonModal
          chapterId={chapter.id}
          lesson={lessonModal.lesson}
          lessonCount={lessons.length}
          onClose={() => setLessonModal({open:false,lesson:null})}
          onSaved={saved => {
            setLessons(ls => lessonModal.lesson ? ls.map(l => l.id === saved.id ? saved : l) : [...ls, saved]);
            setLessonModal({open:false,lesson:null});
            refreshCourse();
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COURSE EDITOR (right panel)
// ══════════════════════════════════════════════════════════════════════════════
const LEVELS = ["beginner","intermediate","advanced"] as const;
const CATEGORIES = ["Crop Production","Livestock Farming","Poultry Farming","Soil Health","Irrigation Systems","Agribusiness","AI in Agriculture"];

function CourseEditor({ course, onUpdated, onDeleted, refreshList }: {
  course: Course; onUpdated: (c: Course) => void; onDeleted: (id: string) => void; refreshList: () => void;
}) {
  const [form, setForm] = useState({
    title: course.title,
    description: course.description ?? "",
    cover_image_url: course.cover_image_url ?? course.image_url ?? "",
    intro_video_url: course.intro_video_url ?? (course.youtube_id ? `https://youtube.com/watch?v=${course.youtube_id}` : ""),
    intro_video_type: (course.intro_video_type ?? "youtube") as "youtube"|"vimeo"|"direct",
    category: course.category,
    level: (course.level ?? "beginner") as typeof LEVELS[number],
    price: Number(course.price ?? 0),
    duration_minutes: Number(course.duration_minutes ?? 0),
    is_published: course.is_published,
    instructor_name: course.instructor_name ?? "",
    instructor_title: course.instructor_title ?? "",
    has_certificate: course.has_certificate ?? false,
  });
  const [saveState, setSaveState] = useState<"idle"|"saving"|"saved">("idle");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [addingChapter, setAddingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const importChaptersBulk = async (titles: string[]) => {
    try {
      const addedChapters: Chapter[] = [];
      for (let i = 0; i < titles.length; i++) {
        const ch = await upsertChapter({ data: {
          course_id: course.id,
          title: titles[i],
          sort_order: chapters.length + i,
          duration_minutes: 10,
          is_published: true,
        }});
        addedChapters.push(ch as Chapter);
      }
      setChapters(cs => [...cs, ...addedChapters]);
      refreshList();
      toast.success(`Imported ${titles.length} chapters! 🎉`);
    } catch {
      toast.error("Failed to import some chapters");
    }
  };

  const loadChapters = useCallback(async () => {
    try {
      const data = await getChapters({ data: { courseId: course.id } });
      setChapters(data as unknown as Chapter[]);
    } catch { toast.error("Failed to load chapters"); }
  }, [course.id]);

  useEffect(() => { loadChapters(); }, [loadChapters]);

  // Debounced auto-save
  const autoSave = useCallback((patch: typeof form) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    debounceRef.current = setTimeout(async () => {
      try {
        await updateAcademyCourseV2({ data: { courseId: course.id, ...patch } });
        setSaveState("saved");
        onUpdated({ ...course, ...patch });
        setTimeout(() => setSaveState("idle"), 2000);
      } catch { setSaveState("idle"); toast.error("Save failed"); }
    }, 1500);
  }, [course.id]);

  const set = (key: keyof typeof form, val: any) => {
    const next = { ...form, [key]: val };
    setForm(next);
    autoSave(next);
  };

  const togglePublish = () => {
    const next = !form.is_published;
    set("is_published", next);
    toast.success(next ? "Course published 🎉" : "Course set to draft");
  };

  const addChapter = async () => {
    if (!newChapterTitle.trim()) return;
    try {
      const ch = await upsertChapter({ data: {
        course_id: course.id, title: newChapterTitle.trim(),
        sort_order: chapters.length, duration_minutes: 0, is_published: false,
      }});
      setChapters(cs => [...cs, ch as Chapter]);
      setNewChapterTitle(""); setAddingChapter(false);
      refreshList();
    } catch { toast.error("Failed to add chapter"); }
  };

  const ytId = form.intro_video_type === "youtube" ? extractYouTubeId(form.intro_video_url) : null;

  const card = "bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-5";

  return (
    <div className="flex-1 overflow-y-auto space-y-5 p-6 bg-gray-50/50">
      {/* Header with Save indicator & Publish Button */}
      <div className="flex items-center justify-between bg-white border border-gray-200 p-6 rounded-2xl shadow-xs">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900 truncate" style={{ fontFamily:"Playfair Display,serif" }}>
            {form.title || "Untitled Course"}
          </h2>
          <span className={`text-[11px] font-bold transition-opacity ${saveState==="idle"?"opacity-0":"opacity-100"} ${saveState==="saved"?"text-[#2D6A4F]":"text-amber-600"}`}>
            {saveState==="saving" ? "Auto-saving…" : "✓ Saved to Database"}
          </span>
        </div>
        
        {/* Prominent Publish Toggle Button */}
        <button
          type="button"
          onClick={togglePublish}
          className={`px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm border ${
            form.is_published
              ? "bg-green-600 hover:bg-green-700 text-white border-green-700"
              : "bg-[#2D6A4F] hover:bg-[#224f3b] text-white border-[#2D6A4F]"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${form.is_published ? "bg-white animate-pulse" : "bg-white/40"}`} />
          {form.is_published ? "Published & Live" : "Publish Course"}
        </button>
      </div>

      {/* ── Section 1: Identity */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F]">Course Identity</span>
        </div>
        <div>
          <label className={lbl}>Title</label>
          <input className={inp} value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="e.g. Advanced Maize Production Masterclass" />
          <p className="text-[10px] text-gray-400 text-right mt-1 font-semibold">{form.title.length}/120 characters</p>
        </div>
        <div>
          <label className={lbl}>Description</label>
          <textarea rows={4} className={`${inp} resize-none`}
            value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="What will learners achieve by completing this course?" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Category</label>
            <select className={`${inp} bg-white`} value={form.category}
              onChange={e => set("category", e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Instructor</label>
            <input className={inp} value={form.instructor_name}
              onChange={e => set("instructor_name", e.target.value)}
              placeholder="e.g. Samuel Kiprono" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={lbl}>Status</label>
            <button type="button" onClick={togglePublish}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-bold cursor-pointer transition w-full ${
                form.is_published 
                  ? "bg-green-50 border-green-200 text-green-800 hover:bg-green-100" 
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}>
              <span className={`h-2.5 w-2.5 rounded-full ${form.is_published ? "bg-green-600 animate-pulse" : "bg-gray-400"}`} />
              {form.is_published ? "Published & Live" : "Draft — Click to Publish"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Price (KES) — 0 = Free</label>
            <input type="number" min={0} className={inp} value={form.price}
              onChange={e => set("price", Number(e.target.value))} />
          </div>
          <div>
            <label className={lbl}>Duration (minutes)</label>
            <input type="number" min={0} className={inp} value={form.duration_minutes}
              onChange={e => set("duration_minutes", Number(e.target.value))} />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input type="checkbox" checked={form.has_certificate}
            onChange={e => set("has_certificate", e.target.checked)}
            className="accent-[#2D6A4F]" />
          <span className="text-xs text-gray-600 font-medium">🏅 Award completion certificate</span>
        </label>
      </div>

      {/* ── Section 2: Media */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F]">Media Assets</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Cover image */}
          <div className="space-y-2">
            <label className={lbl}>Cover Image URL</label>
            <div className="flex gap-2">
              <input className={inp} value={form.cover_image_url}
                onChange={e => set("cover_image_url", e.target.value)}
                placeholder="https://..." />
              <label className="shrink-0 bg-[#2D6A4F] text-white px-3 py-2 text-xs font-bold rounded-lg cursor-pointer hover:bg-[#224f3b] transition flex items-center justify-center">
                <span>Upload</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = (reader.result as string).split(',')[1];
                      try {
                        toast.loading("Uploading cover image...", { id: "upload-cover" });
                        const res = await uploadAcademyFile({ data: { fileName: file.name, fileContentBase64: base64 } });
                        set("cover_image_url", res.url);
                        toast.success("Cover image uploaded successfully!", { id: "upload-cover" });
                      } catch (err) {
                        toast.error("Failed to upload cover image", { id: "upload-cover" });
                      }
                    };
                    reader.readAsDataURL(file);
                  }} />
              </label>
            </div>
            {form.cover_image_url ? (
              <div className="relative h-32 border border-gray-200 rounded-lg overflow-hidden group">
                <img src={form.cover_image_url} alt="cover" className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                <button onClick={() => set("cover_image_url", "")}
                  className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full text-xs w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-red-700 transition">✕</button>
              </div>
            ) : (
              <div className="h-32 border border-dashed border-gray-200 bg-gray-50 rounded-lg flex flex-col items-center justify-center gap-1">
                <span className="text-2xl text-gray-300">🖼</span>
                <span className="text-[11px] text-gray-400 font-medium">Paste image URL or click Upload</span>
              </div>
            )}
          </div>
          {/* Intro video */}
          <div className="space-y-2">
            <label className={lbl}>Intro Video</label>
            <div className="flex gap-1 bg-gray-105 p-1 rounded-lg mb-2">
              {(["youtube","vimeo","direct"] as const).map(vt => (
                <button key={vt} onClick={() => set("intro_video_type", vt)}
                  className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer transition ${
                    form.intro_video_type===vt ? "bg-[#2D6A4F] text-white shadow-xs" : "text-gray-500 hover:text-gray-800 hover:bg-gray-150"
                  }`}>
                  {vt==="youtube"?"YouTube":vt==="vimeo"?"Vimeo":"Direct"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inp} value={form.intro_video_url}
                onChange={e => set("intro_video_url", e.target.value)}
                placeholder={form.intro_video_type==="youtube" ? "https://youtube.com/watch?v=..." : "https://..."} />
              <label className="shrink-0 bg-[#2D6A4F] text-white px-3 py-2 text-xs font-bold rounded-lg cursor-pointer hover:bg-[#224f3b] transition flex items-center justify-center">
                <span>Upload</span>
                <input type="file" accept="video/*" className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = (reader.result as string).split(',')[1];
                      try {
                        toast.loading("Uploading intro video...", { id: "upload-intro" });
                        const res = await uploadAcademyFile({ data: { fileName: file.name, fileContentBase64: base64 } });
                        set("intro_video_url", res.url);
                        set("intro_video_type", "direct");
                        toast.success("Intro video uploaded successfully!", { id: "upload-intro" });
                      } catch (err) {
                        toast.error("Failed to upload intro video", { id: "upload-intro" });
                      }
                    };
                    reader.readAsDataURL(file);
                  }} />
              </label>
            </div>
            {ytId ? (
              <div className="rounded-lg overflow-hidden border border-gray-200">
                <img src={ytThumb(ytId)} alt="yt thumb" className="w-full h-24 object-cover" />
              </div>
            ) : (
              <div className="h-24 border border-dashed border-gray-200 bg-gray-50 rounded-lg flex items-center justify-center">
                <span className="text-[11px] text-gray-400 font-medium">Video preview or click Upload</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Curriculum */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-150">
          <div>
            <span className="font-bold text-gray-900 text-base" style={{ fontFamily:"Playfair Display,serif" }}>Course Curriculum</span>
            <p className="text-[11px] text-gray-500 mt-1 font-semibold">{chapters.length} chapters · {chapters.reduce((a,c) => a+(c.lesson_count??0),0)} lessons</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setImportModalOpen(true)}
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold px-3 py-2 transition duration-150 cursor-pointer flex items-center gap-1.5 shadow-xs bg-white">
              📂 Paste / Upload Syllabus
            </button>
            <button onClick={() => setAddingChapter(true)}
              className="bg-[#2D6A4F] text-white hover:bg-[#224f3b] rounded-lg text-xs font-bold px-3 py-2 transition duration-150 cursor-pointer shadow-xs">
              + Add Chapter
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-150">
          {chapters.map((ch, i) => (
            <ChapterRow
              key={ch.id} chapter={ch} courseId={course.id} idx={i}
              onUpdated={updated => setChapters(cs => cs.map(c => c.id===updated.id ? updated : c))}
              onDeleted={id => { setChapters(cs => cs.filter(c => c.id!==id)); refreshList(); }}
              refreshCourse={loadChapters}
            />
          ))}
          {chapters.length === 0 && !addingChapter && (
            <div className="p-8 text-center bg-gray-50/50">
              <div className="max-w-xs mx-auto space-y-3 flex flex-col items-center">
                <span className="text-3xl select-none">📚</span>
                <p className="text-xs text-gray-500 font-semibold leading-relaxed">No curriculum chapters created yet. Build your syllabus to publish lessons.</p>
                <button onClick={() => setAddingChapter(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#224f3b] cursor-pointer transition shadow-xs">
                  <span>+</span> Add First Chapter
                </button>
              </div>
            </div>
          )}
        </div>

        {/* New chapter input */}
        {addingChapter && (
          <div className="px-4 py-3.5 border-t border-gray-150 bg-gray-50 flex items-center gap-2">
            <input autoFocus className={`${inp} flex-1`}
              value={newChapterTitle}
              onChange={e => setNewChapterTitle(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter") addChapter(); if (e.key==="Escape") { setAddingChapter(false); setNewChapterTitle(""); } }}
              placeholder="Chapter title (Enter to save, Esc to cancel)" />
            <button onClick={addChapter} className="px-3.5 py-2.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold cursor-pointer hover:bg-[#224f3b] transition">Add</button>
            <button onClick={() => { setAddingChapter(false); setNewChapterTitle(""); }}
              className="px-3.5 py-2.5 rounded-lg bg-gray-250 text-gray-700 text-xs font-bold cursor-pointer hover:bg-gray-300 transition">Cancel</button>
          </div>
        )}
      </div>

      {/* Delete course */}
      <div className="pt-2 text-right">
        <button onClick={async () => {
          if (!confirm(`Delete "${course.title}"? This is irreversible.`)) return;
          try {
            await deleteAcademyCourseV2({ data: { courseId: course.id } });
            onDeleted(course.id); toast.success("Course deleted");
          } catch { toast.error("Failed to delete course"); }
        }} className="text-xs text-red-600 font-bold hover:underline cursor-pointer">
          Delete this course permanently
        </button>
      </div>

      {importModalOpen && (
        <SyllabusImportModal
          onImport={importChaptersBulk}
          onClose={() => setImportModalOpen(false)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NEW COURSE FORM
// ══════════════════════════════════════════════════════════════════════════════
// ── Types ──────────────────────────────────────────────────────────────────
type FormChapter = {
  title: string;
  contentType: "paste" | "upload";
  pastedText: string;
  fileName: string;
  fileSize?: string;
  fileUrl?: string;
};

// ══════════════════════════════════════════════════════════════════════════════
// NEW COURSE FORM
// ══════════════════════════════════════════════════════════════════════════════
function NewCourseForm({ onCreated, onCancel }: { onCreated: (c: Course) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [introVideoType, setIntroVideoType] = useState<"youtube" | "vimeo" | "direct" | undefined>("youtube");
  const [category, setCategory] = useState("Crop Production");
  const level = "beginner" as typeof LEVELS[number];
  const [price, setPrice] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [instructorName, setInstructorName] = useState("");
  const [instructorTitle, setInstructorTitle] = useState("");
  const [hasCertificate, setHasCertificate] = useState(false);
  const [chaptersList, setChaptersList] = useState<FormChapter[]>([
    { title: "", contentType: "paste", pastedText: "", fileName: "" }
  ]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleBulkImport = (titles: string[]) => {
    const newChaps = titles.map(t => ({
      title: t,
      contentType: "paste" as const,
      pastedText: "",
      fileName: "",
    }));
    setChaptersList(prev => {
      if (prev.length === 1 && !prev[0].title) {
        return newChaps;
      }
      return [...prev, ...newChaps];
    });
  };

  const create = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      // 1. Create course
      const c = await createAcademyCourseV2({ data: {
        title,
        description,
        cover_image_url: coverImageUrl || undefined,
        intro_video_url: introVideoUrl || undefined,
        intro_video_type: introVideoType,
        category,
        level,
        price,
        duration_minutes: durationMinutes,
        is_published: false,
        instructor_name: instructorName,
        instructor_title: instructorTitle,
        has_certificate: hasCertificate,
      }});

      // 2. Insert chapters & create lessons
      for (let i = 0; i < chaptersList.length; i++) {
        const item = chaptersList[i];
        const chTitle = item.title.trim() || `Chapter ${i + 1}`;
        
        // Save chapter
        const ch = await upsertChapter({ data: {
          course_id: c.id,
          title: chTitle,
          description: item.contentType === "paste" ? item.pastedText : "",
          sort_order: i,
          duration_minutes: 10,
          is_published: true,
        }});

        // If pasted text notes, create a text lesson
        if (item.contentType === "paste" && item.pastedText.trim()) {
          await upsertLesson({ data: {
            chapter_id: ch.id,
            title: "Syllabus Notes & Details",
            content_type: "text",
            text_content: item.pastedText,
            sort_order: 0,
            is_free_preview: true,
          }});
        }

        // If uploaded file, create a pdf lesson
        if (item.contentType === "upload" && item.fileName) {
          await upsertLesson({ data: {
            chapter_id: ch.id,
            title: item.fileName,
            content_type: "pdf",
            pdf_url: item.fileUrl || `https://cdn.mqulima.co.ke/docs/${item.fileName}`,
            sort_order: 0,
            is_free_preview: true,
          }});
        }
      }

      onCreated(c as Course);
      toast.success("Course created successfully with chapters! 🎉");
    } catch {
      toast.error("Failed to create course");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50">
      <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-lg w-full max-w-2xl space-y-6">
        <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3" style={{ fontFamily:"Playfair Display,serif" }}>New Course</h3>
        
        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
          {/* Title */}
          <div className="col-span-2">
            <label className={lbl}>Title</label>
            <input autoFocus className={inp} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Advanced Avocado Farming" />
          </div>

          {/* Description */}
          <div className="col-span-2">
            <label className={lbl}>Description</label>
            <textarea rows={3} className={`${inp} resize-none`} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What will learners achieve by completing this course?" />
          </div>

          {/* Category */}
          <div className="col-span-2">
            <label className={lbl}>Category</label>
            <select className={`${inp} bg-white`} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Price & Duration */}
          <div>
            <label className={lbl}>Price (KES) — 0 = Free</label>
            <input type="number" min={0} className={inp} value={price} onChange={e => setPrice(Number(e.target.value))} />
          </div>

          <div>
            <label className={lbl}>Duration (minutes)</label>
            <input type="number" min={0} className={inp} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} />
          </div>

          {/* Instructor details */}
          <div>
            <label className={lbl}>Instructor Name</label>
            <input className={inp} value={instructorName} onChange={e => setInstructorName(e.target.value)} placeholder="e.g. Samuel Kiprono" />
          </div>

          <div>
            <label className={lbl}>Instructor Title</label>
            <input className={inp} value={instructorTitle} onChange={e => setInstructorTitle(e.target.value)} placeholder="e.g. Lead Horticulturist" />
          </div>

          {/* Media fields */}
          <div>
            <label className={lbl}>Cover Image URL</label>
            <div className="flex gap-2">
              <input className={inp} value={coverImageUrl} onChange={e => setCoverImageUrl(e.target.value)} placeholder="https://images.unsplash.com/... or upload a file" />
              <label className="shrink-0 bg-[#2D6A4F] text-white px-3 py-2 text-xs font-bold rounded-lg cursor-pointer hover:bg-[#224f3b] transition flex items-center justify-center">
                <span>Upload</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = (reader.result as string).split(',')[1];
                      try {
                        toast.loading("Uploading cover image...", { id: "new-upload-cover" });
                        const res = await uploadAcademyFile({ data: { fileName: file.name, fileContentBase64: base64 } });
                        setCoverImageUrl(res.url);
                        toast.success("Cover image uploaded successfully!", { id: "new-upload-cover" });
                      } catch (err) {
                        toast.error("Failed to upload cover image", { id: "new-upload-cover" });
                      }
                    };
                    reader.readAsDataURL(file);
                  }} />
              </label>
            </div>
          </div>

          <div>
            <label className={lbl}>Intro Video URL</label>
            <div className="flex gap-1 bg-gray-105 p-1 rounded-lg mb-1.5">
              {(["youtube", "vimeo", "direct"] as const).map(vt => (
                <button key={vt} type="button" onClick={() => setIntroVideoType(vt)}
                  className={`flex-1 py-1 rounded-md text-[10px] font-bold cursor-pointer transition ${
                    introVideoType===vt ? "bg-[#2D6A4F] text-white shadow-xs" : "text-gray-500 hover:text-gray-800 hover:bg-gray-150"
                  }`}>
                  {vt==="youtube"?"YouTube":vt==="vimeo"?"Vimeo":"Direct"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inp} value={introVideoUrl} onChange={e => setIntroVideoUrl(e.target.value)} placeholder={introVideoType==="youtube" ? "https://youtube.com/watch?v=..." : "https://... or upload a file"} />
              <label className="shrink-0 bg-[#2D6A4F] text-white px-3 py-2 text-xs font-bold rounded-lg cursor-pointer hover:bg-[#224f3b] transition flex items-center justify-center">
                <span>Upload</span>
                <input type="file" accept="video/*" className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = (reader.result as string).split(',')[1];
                      try {
                        toast.loading("Uploading intro video...", { id: "new-upload-intro" });
                        const res = await uploadAcademyFile({ data: { fileName: file.name, fileContentBase64: base64 } });
                        setIntroVideoUrl(res.url);
                        setIntroVideoType("direct");
                        toast.success("Intro video uploaded successfully!", { id: "new-upload-intro" });
                      } catch (err) {
                        toast.error("Failed to upload intro video", { id: "new-upload-intro" });
                      }
                    };
                    reader.readAsDataURL(file);
                  }} />
              </label>
            </div>
          </div>

          {/* Certificate checkbox */}
          <div className="col-span-2 flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hasCertificate} onChange={e => setHasCertificate(e.target.checked)} className="accent-[#2D6A4F]" />
              <span className="text-xs text-gray-600 font-semibold">Award completion certificate</span>
            </label>
          </div>

          {/* Course Chapters & Syllabus Section */}
          <div className="col-span-2 border-t border-gray-100 pt-5 space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F] block">Course Chapters & Syllabus</label>
              <button type="button" onClick={() => setImportModalOpen(true)}
                className="text-[11px] text-[#2D6A4F] hover:text-[#224f3b] font-bold underline cursor-pointer">
                📂 Import Syllabus Outline (.txt)
              </button>
            </div>

            <div className="space-y-4">
              {chaptersList.map((ch, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-5 bg-gray-50/30 relative space-y-4 shadow-2xs hover:border-gray-300 transition">
                  {/* Chapter Card Header */}
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono font-black text-white bg-[#2D6A4F] px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                      Chapter {String(idx + 1).padStart(2, "0")}
                    </span>
                    {chaptersList.length > 1 && (
                      <button type="button" onClick={() => setChaptersList(prev => prev.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-600 transition text-xs font-bold cursor-pointer">
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Chapter Title */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Chapter Title</label>
                      <input className={inp} value={ch.title}
                        onChange={e => {
                          const val = e.target.value;
                          setChaptersList(prev => prev.map((item, i) => i === idx ? { ...item, title: val } : item));
                        }}
                        placeholder={`e.g. Chapter ${idx + 1}: Introduction & Key Concepts`} />
                    </div>

                    {/* Content Selector */}
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Chapter Content Option</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setChaptersList(prev => prev.map((item, i) => i === idx ? { ...item, contentType: "paste" } : item))}
                          className={`flex-1 py-2 px-3 border rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            ch.contentType === "paste"
                              ? "bg-[#2D6A4F] text-white border-[#2D6A4F] shadow-xs"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}>
                          <span>📄</span> Paste Text Notes
                        </button>
                        <button type="button" onClick={() => setChaptersList(prev => prev.map((item, i) => i === idx ? { ...item, contentType: "upload" } : item))}
                          className={`flex-1 py-2 px-3 border rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            ch.contentType === "upload"
                              ? "bg-[#2D6A4F] text-white border-[#2D6A4F] shadow-xs"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}>
                          <span>📤</span> Upload Resource
                        </button>
                      </div>
                    </div>

                    {/* Paste Text Area */}
                    {ch.contentType === "paste" && (
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Paste Chapter Notes (Markdown)</label>
                        <textarea rows={4} className={`${inp} resize-none font-mono text-xs`} value={ch.pastedText}
                          onChange={e => {
                            const val = e.target.value;
                            setChaptersList(prev => prev.map((item, i) => i === idx ? { ...item, pastedText: val } : item));
                          }}
                          placeholder="Paste or write detailed guides, guidelines, or text notes for this chapter..." />
                      </div>
                    )}

                    {/* Upload File Input */}
                    {ch.contentType === "upload" && (
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Upload File (.pdf, .txt, .docx)</label>
                        {ch.fileName ? (
                          <div className="flex items-center justify-between border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 rounded-lg p-3 text-xs font-semibold text-gray-800">
                            <span className="truncate flex items-center gap-2 text-[#2D6A4F]">
                              <span>📄</span> {ch.fileName} {ch.fileSize ? `(${ch.fileSize})` : ""}
                            </span>
                            <button type="button" onClick={() => setChaptersList(prev => prev.map((item, i) => i === idx ? { ...item, fileName: "", fileSize: undefined } : item))}
                              className="text-red-500 hover:text-red-700 font-bold transition cursor-pointer px-1">✕ Remove</button>
                          </div>
                        ) : (
                          <div className="relative border border-dashed border-gray-300 rounded-lg p-6 bg-white hover:bg-gray-50 transition cursor-pointer flex flex-col items-center justify-center gap-1.5"
                            onClick={() => {
                              const inputEl = document.getElementById(`chapter-file-${idx}`);
                              inputEl?.click();
                            }}>
                            <span className="text-2xl text-gray-300">📤</span>
                            <span className="text-[11px] text-gray-500 font-bold">Click to choose a file or drag here</span>
                            <span className="text-[9px] text-gray-400">PDF, Word, or Text up to 10MB</span>
                            <input type="file" id={`chapter-file-${idx}`} accept=".pdf,.txt,.docx,.doc" className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const sizeStr = file.size > 1024 * 1024
                                  ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                                  : `${Math.round(file.size / 1024)} KB`;
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                  const base64 = (reader.result as string).split(',')[1];
                                  try {
                                    toast.loading(`Uploading ${file.name}...`, { id: `upload-chapter-${idx}` });
                                    const res = await uploadAcademyFile({ data: { fileName: file.name, fileContentBase64: base64 } });
                                    setChaptersList(prev => prev.map((item, i) => i === idx ? { ...item, fileName: file.name, fileSize: sizeStr, fileUrl: res.url } : item));
                                    toast.success("File uploaded successfully!", { id: `upload-chapter-${idx}` });
                                  } catch (err) {
                                    toast.error("Failed to upload file", { id: `upload-chapter-${idx}` });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Buttons row */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => {
                setChaptersList(prev => [...prev, { title: "", contentType: "paste", pastedText: "", fileName: "" }]);
              }} className="flex-1 py-3 border border-dashed border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#2D6A4F]/5 rounded-xl text-xs font-bold cursor-pointer transition flex items-center justify-center gap-2">
                <span>+</span> Add Next Chapter (Chapter {chaptersList.length + 1})
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-gray-100">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer hover:bg-gray-300 transition">Cancel</button>
          <button onClick={create} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold cursor-pointer hover:bg-[#224f3b] disabled:opacity-60 flex items-center justify-center gap-2 transition">
            {saving && <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Create Course
          </button>
        </div>
      </div>

      {importModalOpen && (
        <SyllabusImportModal
          onImport={handleBulkImport}
          onClose={() => setImportModalOpen(false)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ACADEMY BUILDER
// ══════════════════════════════════════════════════════════════════════════════
export function AcademyBuilder() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Course | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getAcademyCourses();
      setCourses(data as unknown as Course[]);
    } catch { toast.error("Failed to load courses"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Stats
  const published = courses.filter(c => c.is_published).length;
  const totalLessons = courses.reduce((a,c) => a + (c.lesson_count ?? 0), 0);

  return (
    <div className="flex flex-col h-full min-h-[600px] space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Courses", val: courses.length },
          { label: "Published", val: published },
          { label: "Draft", val: courses.length - published },
          { label: "Total Lessons", val: totalLessons },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-150 px-5 py-4.5 shadow-xs">
            <p className="text-2xl font-bold text-[#2D6A4F]">{s.val}</p>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Builder: sidebar + editor */}
      <div className="flex gap-0 border border-gray-200 rounded-2xl flex-1 min-h-[520px] overflow-hidden bg-white shadow-xs">
        {/* ── Left sidebar: course list */}
        <div className="w-[320px] shrink-0 border-r border-gray-200 flex flex-col bg-white">
          {/* Sidebar header */}
          <div className="px-5 py-5 border-b border-gray-150">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold text-gray-900 text-base" style={{ fontFamily:"Playfair Display,serif" }}>Academy Catalog</span>
              <span className="text-xs text-gray-500 font-medium">{courses.length} courses</span>
            </div>
            <button
              onClick={() => { setCreating(true); setSelected(null); }}
              className="mt-3.5 w-full py-2.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#224f3b] transition cursor-pointer shadow-xs">
              + New Course
            </button>
          </div>

          {/* Course list */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-150">
            {loading && (
              <div className="py-12 text-center text-gray-400 text-sm font-medium">Loading catalog…</div>
            )}
            {!loading && courses.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm italic">No courses found</div>
            )}
            {courses.map(c => (
              <button key={c.id} onClick={() => { setSelected(c); setCreating(false); }}
                className={`w-full text-left px-5 py-4 flex gap-3.5 items-start hover:bg-gray-50 transition cursor-pointer ${
                  selected?.id===c.id ? "border-l-4 border-[#2D6A4F] bg-gray-50/70" : "border-l-4 border-transparent"
                }`}>
                {/* Thumbnail */}
                <div className="w-12 h-12 shrink-0 bg-gray-100 border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center shadow-xs">
                  {(c.cover_image_url || c.image_url) ? (
                    <img src={c.cover_image_url || c.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">🎓</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.title}</p>
                  <p className="text-[11px] text-gray-500 mt-1 font-semibold">{c.chapter_count} chapters · {c.lesson_count} lessons</p>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      c.is_published ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {c.is_published ? "Published" : "Draft"}
                    </span>
                    <span className="text-[10px] text-[#2D6A4F] font-bold flex items-center gap-0.5 group-hover:underline">
                      Edit Course ➔
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: editor area */}
        {creating ? (
          <NewCourseForm
            onCreated={c => { setCourses(cs => [c, ...cs]); setSelected(c); setCreating(false); }}
            onCancel={() => setCreating(false)}
          />
        ) : selected ? (
          <CourseEditor
            key={selected.id}
            course={selected}
            onUpdated={updated => { setCourses(cs => cs.map(c => c.id===updated.id ? {...c,...updated} : c)); setSelected(prev => prev?.id===updated.id ? {...prev,...updated} : prev); }}
            onDeleted={id => { setCourses(cs => cs.filter(c => c.id!==id)); setSelected(null); }}
            refreshList={load}
          />
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8 bg-gray-50/30">
            <span className="text-6xl select-none">🎓</span>
            <h3 className="text-xl font-bold text-gray-800" style={{ fontFamily:"Playfair Display,serif" }}>Select a course to edit</h3>
            <p className="text-sm text-gray-500 max-w-xs">Manage curriculums, organize lessons, upload resources, and publish online masterclasses.</p>
            <button onClick={() => setCreating(true)}
              className="mt-2 px-5 py-2.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#224f3b] cursor-pointer transition shadow-xs">
              + Create First Course
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AcademyBuilder;
