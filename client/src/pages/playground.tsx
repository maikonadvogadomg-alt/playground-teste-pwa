import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";
import {
  Play,
  Code2,
  Eye,
  Copy,
  Download,
  Trash2,
  FileCode,
  Paintbrush,
  Braces,
  Save,
  FolderOpen,
  RotateCcw,
  Pencil,
  Check,
  X,
  Search,
  CodeXml,
  Gavel,
  Upload,
  Maximize,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Snippet } from "@shared/schema";

const DEFAULT_HTML = `<div style="max-width: 600px; margin: 40px auto; padding: 20px; font-family: sans-serif;">
  <h1 style="color: #333;">Bem-vindo ao HTML Playground</h1>
  <p style="color: #666; margin: 16px 0;">Cole seu codigo HTML aqui e veja o resultado ao vivo!</p>
  <button onclick="alert('Funcionou!')" style="padding: 10px 24px; font-size: 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;">Clique aqui</button>
</div>`;

const DEFAULT_CSS = ``;

const DEFAULT_JS = `// Exemplo de consulta ao Mock do CNJ (SwaggerHub)
async function testarAPI() {
  const baseUrl = "https://virtserver.swaggerhub.com/MAIKONMG1_12/CNJ/1.0.0";
  const endpoint = "/domicilio-eletronico/api/v1/representados";
  
  try {
    const response = await fetch(baseUrl + endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer SEUTOKENAQUI"
      }
    });
    
    if (!response.ok) {
      throw new Error("Erro HTTP: " + response.status);
    }
    
    const data = await response.json();
    console.log("Dados recebidos do SwaggerHub:", data);
    alert("Sucesso! Verifique os dados no console do navegador (F12).");
  } catch (error) {
    console.error("Erro na requisição:", error);
    alert("Erro na requisição: " + error.message);
  }
}

// Para testar, descomente a linha abaixo e clique em 'Executar'
// testarAPI();`;

const AUTOSAVE_KEY = "html-playground-autosave";

type ActiveTab = "html" | "css" | "js";
type MobileView = "editor" | "preview";

export default function Playground() {
  const [html, setHtml] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) return JSON.parse(saved).html || DEFAULT_HTML;
    } catch {}
    return DEFAULT_HTML;
  });
  const [css, setCss] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedHtml = parsed.html || "";
        const lower = savedHtml.trim().toLowerCase();
        const isComplete = lower.includes("<!doctype") || (lower.includes("<html") && lower.includes("</html>"));
        if (isComplete) return "";
        return parsed.css ?? DEFAULT_CSS;
      }
    } catch {}
    return DEFAULT_CSS;
  });
  const [js, setJs] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedHtml = parsed.html || "";
        const lower = savedHtml.trim().toLowerCase();
        const isComplete = lower.includes("<!doctype") || (lower.includes("<html") && lower.includes("</html>"));
        if (isComplete) return "";
        return parsed.js ?? DEFAULT_JS;
      }
    } catch {}
    return DEFAULT_JS;
  });
  const [title, setTitle] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) return JSON.parse(saved).title || "Sem titulo";
    } catch {}
    return "Sem titulo";
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>("html");
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("editor");
  const [autoRun, setAutoRun] = useState(true);
  const [savedDialogOpen, setSavedDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mobileIframeRef = useRef<HTMLIFrameElement>(null);
  const htmlFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ html, css, js, title }));
    } catch {}
  }, [html, css, js, title]);

  const prevHtmlWasComplete = useRef(false);
  useEffect(() => {
    const lower = html.trim().toLowerCase();
    const isComplete = lower.includes("<!doctype") || (lower.includes("<html") && lower.includes("</html>"));
    if (isComplete && !prevHtmlWasComplete.current) {
      if (css !== "" || js !== "") {
        setCss("");
        setJs("");
      }
    }
    prevHtmlWasComplete.current = isComplete;
  }, [html]);

  const isCompleteDocument = useCallback((code: string) => {
    const trimmed = code.trim().toLowerCase();
    return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
  }, []);

  const extractCompleteDocument = useCallback((code: string) => {
    const lower = code.toLowerCase();
    const doctypeIdx = lower.indexOf("<!doctype");
    const htmlIdx = lower.indexOf("<html");
    const startIdx = doctypeIdx >= 0 ? doctypeIdx : htmlIdx;
    if (startIdx > 0) {
      return code.substring(startIdx);
    }
    return code;
  }, []);

  const hasCompleteDocument = useCallback((code: string) => {
    const lower = code.trim().toLowerCase();
    return lower.includes("<!doctype") || (lower.includes("<html") && lower.includes("</html>"));
  }, []);

  const handleHtmlPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (hasCompleteDocument(pasted)) {
      e.preventDefault();
      const cleaned = extractCompleteDocument(pasted);
      setHtml(cleaned);
      setCss("");
      setJs("");
      toast({ title: "Documento completo detectado", description: "CSS e JS limpos automaticamente. Seu codigo sera usado como esta." });
    }
  }, [hasCompleteDocument, extractCompleteDocument, toast]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (!content) {
        toast({ title: "Erro", description: "Arquivo vazio ou nao pode ser lido.", variant: "destructive" });
        return;
      }
      const fileName = file.name.replace(/\.[^.]+$/, "") || "Importado";
      if (hasCompleteDocument(content)) {
        setHtml(extractCompleteDocument(content));
        setCss("");
        setJs("");
        setTitle(fileName);
        setActiveTab("html");
        toast({ title: "Arquivo importado!", description: `"${file.name}" carregado como documento completo.` });
      } else {
        setHtml(content);
        setTitle(fileName);
        setActiveTab("html");
        toast({ title: "Arquivo importado!", description: `"${file.name}" carregado no editor HTML.` });
      }
    };
    reader.onerror = () => {
      toast({ title: "Erro", description: "Nao foi possivel ler o arquivo.", variant: "destructive" });
    };
    reader.readAsText(file);
    if (htmlFileInputRef.current) htmlFileInputRef.current.value = "";
  }, [hasCompleteDocument, extractCompleteDocument, toast]);

  const buildDocument = useCallback(() => {
    const completeDoc = hasCompleteDocument(html);
    if (completeDoc) {
      let doc = extractCompleteDocument(html);
      if (!doc.toLowerCase().includes("<meta charset")) {
        const headMatch = doc.match(/<head[^>]*>/i);
        if (headMatch) {
          doc = doc.replace(headMatch[0], `${headMatch[0]}\n<meta charset="UTF-8">`);
        }
      }
      if (!doc.toLowerCase().includes("viewport")) {
        const headMatch = doc.match(/<head[^>]*>/i);
        if (headMatch) {
          doc = doc.replace(headMatch[0], `${headMatch[0]}\n<meta name="viewport" content="width=device-width, initial-scale=1.0">`);
        }
      }
      return doc;
    }
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>
${html}
<script>${js}<\/script>
</body>
</html>`;
  }, [html, css, js, hasCompleteDocument, extractCompleteDocument]);

  const prevBlobUrl = useRef<string | null>(null);

  const updatePreview = useCallback(() => {
    const doc = buildDocument();
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
    }
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    prevBlobUrl.current = blobUrl;
    if (iframeRef.current) {
      iframeRef.current.src = blobUrl;
    }
    if (mobileIframeRef.current) {
      mobileIframeRef.current.src = blobUrl;
    }
  }, [buildDocument]);

  useEffect(() => {
    if (autoRun) {
      const timer = setTimeout(updatePreview, 500);
      return () => clearTimeout(timer);
    }
  }, [html, css, js, autoRun, updatePreview]);

  useEffect(() => {
    updatePreview();
  }, []);

  useEffect(() => {
    if (mobileView === "preview") {
      const timer = setTimeout(() => {
        updatePreview();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [mobileView, buildDocument]);

  const savedSnippets = useQuery<Snippet[]>({
    queryKey: ["/api/snippets"],
  });

  const saveSnippetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/snippets", { title, html, css, js });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({ title: "Salvo!", description: "Codigo salvo com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao salvar.", variant: "destructive" });
    },
  });

  const deleteSnippetMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/snippets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({ title: "Removido", description: "Codigo removido." });
    },
  });

  const renameSnippetMutation = useMutation({
    mutationFn: async ({ id, newTitle }: { id: string; newTitle: string }) => {
      const res = await apiRequest("PATCH", `/api/snippets/${id}`, { title: newTitle });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      setRenamingId(null);
      toast({ title: "Renomeado!", description: "Nome atualizado." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao renomear.", variant: "destructive" });
    },
  });

  const loadSnippet = (snippet: Snippet) => {
    setTitle(snippet.title);
    if (hasCompleteDocument(snippet.html)) {
      setHtml(extractCompleteDocument(snippet.html));
      setCss("");
      setJs("");
    } else {
      setHtml(snippet.html);
      setCss(snippet.css);
      setJs(snippet.js);
    }
    setSavedDialogOpen(false);
    toast({ title: "Carregado!", description: `"${snippet.title}" aberto.` });
  };

  const handleCopyCode = () => {
    const doc = buildDocument();
    navigator.clipboard.writeText(doc);
    toast({ title: "Copiado!", description: "Codigo copiado." });
  };

  const handleDownload = () => {
    const doc = buildDocument();
    const blob = new Blob([doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "playground"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Baixado!", description: "Arquivo HTML salvo no seu aparelho." });
  };

  const handleFullScreen = () => {
    const doc = buildDocument();
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleClear = () => {
    setHtml("");
    setCss("");
    setJs("");
    setTitle("Sem titulo");
  };

  const handleReset = () => {
    setHtml(DEFAULT_HTML);
    setCss(DEFAULT_CSS);
    setJs(DEFAULT_JS);
    setTitle("Sem titulo");
  };

  const getEditorValue = () => {
    if (activeTab === "html") return html;
    if (activeTab === "css") return css;
    return js;
  };

  const setEditorValue = (value: string) => {
    if (activeTab === "html") setHtml(value);
    if (activeTab === "css") setCss(value);
    if (activeTab === "js") setJs(value);
  };

  const getTabIcon = (tab: ActiveTab) => {
    if (tab === "html") return <FileCode className="w-3.5 h-3.5" />;
    if (tab === "css") return <Paintbrush className="w-3.5 h-3.5" />;
    return <Braces className="w-3.5 h-3.5" />;
  };

  const currentValue = getEditorValue();

  const filteredSnippets = savedSnippets.data?.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRenaming = (snippet: Snippet, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(snippet.id);
    setRenameValue(snippet.title);
  };

  const confirmRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (renameValue.trim()) {
      renameSnippetMutation.mutate({ id, newTitle: renameValue.trim() });
    }
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="playground-container">
      <header className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 border-b bg-card/50 backdrop-blur-sm shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <Code2 className="w-5 h-5 text-primary shrink-0" />
          <span className="font-semibold text-sm hidden sm:inline whitespace-nowrap">HTML Playground</span>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xs w-24 sm:w-36 bg-transparent border-transparent focus:border-border"
            placeholder="Nome do projeto..."
            data-testid="input-title"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex items-center gap-0.5 sm:hidden">
            <Button
              size="icon"
              variant={mobileView === "editor" ? "default" : "ghost"}
              onClick={() => setMobileView("editor")}
              data-testid="button-mobile-editor"
            >
              <CodeXml className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant={mobileView === "preview" ? "default" : "ghost"}
              onClick={() => { setMobileView("preview"); updatePreview(); }}
              data-testid="button-mobile-preview"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>

          <div className="h-4 w-px bg-border sm:hidden" />

          <Button
            variant={autoRun ? "default" : "outline"}
            onClick={() => setAutoRun(!autoRun)}
            className="text-xs gap-1 hidden sm:inline-flex"
            data-testid="button-auto-run"
          >
            <Eye className="w-3.5 h-3.5" />
            Auto
          </Button>

          {!autoRun && (
            <Button
              variant="default"
              onClick={updatePreview}
              className="text-xs gap-1"
              data-testid="button-run"
            >
              <Play className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Executar</span>
            </Button>
          )}

          <div className="h-4 w-px bg-border hidden sm:block" />

          <input
            ref={htmlFileInputRef}
            type="file"
            accept=".html,.htm,.svg,.xml,.txt,text/html"
            className="hidden"
            onChange={handleFileImport}
            data-testid="input-import-html"
          />
          <Button size="icon" variant="ghost" onClick={() => htmlFileInputRef.current?.click()} data-testid="button-import-html">
            <Upload className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleFullScreen} data-testid="button-fullscreen">
            <Maximize className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleCopyCode} data-testid="button-copy">
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleDownload} data-testid="button-download">
            <Download className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => saveSnippetMutation.mutate()}
            disabled={saveSnippetMutation.isPending}
            data-testid="button-save"
          >
            <Save className="w-4 h-4" />
          </Button>

          <Dialog open={savedDialogOpen} onOpenChange={(open) => { setSavedDialogOpen(open); if (!open) { setRenamingId(null); setSearchQuery(""); } }}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-open-snippets">
                <FolderOpen className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Meus Codigos Salvos</DialogTitle>
              </DialogHeader>

              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="pl-8 text-sm"
                  data-testid="input-search-snippets"
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-1.5">
                {savedSnippets.isLoading && (
                  <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                )}
                {filteredSnippets && filteredSnippets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {searchQuery ? "Nenhum resultado encontrado." : "Nenhum codigo salvo ainda."}
                  </p>
                )}
                {filteredSnippets?.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                    onClick={() => renamingId !== snippet.id && loadSnippet(snippet)}
                    data-testid={`snippet-item-${snippet.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      {renamingId === snippet.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmRename(snippet.id, e as any);
                              if (e.key === "Escape") { setRenamingId(null); }
                            }}
                            data-testid={`input-rename-${snippet.id}`}
                          />
                          <Button size="icon" variant="ghost" onClick={(e) => confirmRename(snippet.id, e)} data-testid={`button-confirm-rename-${snippet.id}`}>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelRename} data-testid={`button-cancel-rename-${snippet.id}`}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium truncate">{snippet.title}</p>
                          <p className="text-xs text-muted-foreground">
                            HTML: {snippet.html.length} | CSS: {snippet.css.length} | JS: {snippet.js.length}
                          </p>
                        </>
                      )}
                    </div>
                    {renamingId !== snippet.id && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => startRenaming(snippet, e)}
                          data-testid={`button-rename-snippet-${snippet.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSnippetMutation.mutate(snippet.id);
                          }}
                          data-testid={`button-delete-snippet-${snippet.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <div className="h-4 w-px bg-border" />

          <Button size="icon" variant="ghost" onClick={handleReset} data-testid="button-reset">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleClear} data-testid="button-clear">
            <Trash2 className="w-4 h-4" />
          </Button>

          <Link href="/">
            <Button variant="default" data-testid="button-legal-assistant">
              <Gavel className="w-4 h-4" />
              <span className="hidden sm:inline">Assistente Juridico</span>
              <span className="sm:hidden">Assistente</span>
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Desktop: lado a lado */}
      <div className="hidden sm:flex flex-1 overflow-hidden">
        {!editorCollapsed && (
          <div className="flex flex-col w-1/2 border-r shrink-0">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b bg-muted/30 shrink-0">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as ActiveTab)}
              >
                <TabsList>
                  <TabsTrigger value="html" className="text-xs gap-1 px-2.5" data-testid="tab-html">
                    {getTabIcon("html")}
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="css" className="text-xs gap-1 px-2.5" data-testid="tab-css">
                    {getTabIcon("css")}
                    CSS
                  </TabsTrigger>
                  <TabsTrigger value="js" className="text-xs gap-1 px-2.5" data-testid="tab-js">
                    {getTabIcon("js")}
                    JS
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2 pr-1">
                {hasCompleteDocument(html) && activeTab === "html" && (
                  <span className="text-[10px] text-primary" data-testid="text-full-doc">Documento completo</span>
                )}
                <span className="text-[10px] text-muted-foreground tabular-nums" data-testid="text-line-count">
                  {currentValue.split("\n").length} linhas
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditorCollapsed(true)}
                  data-testid="button-collapse-editor"
                  title="Minimizar editor"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
              <div className="absolute inset-0 flex">
                <div className="w-10 shrink-0 bg-muted/20 border-r flex flex-col items-end py-2 pr-2 overflow-hidden select-none pointer-events-none">
                  {currentValue.split("\n").map((_line: string, i: number) => (
                    <span key={i} className="text-[10px] leading-[1.625rem] text-muted-foreground/50 tabular-nums">
                      {i + 1}
                    </span>
                  ))}
                </div>
                <textarea
                  value={currentValue}
                  onChange={(e) => setEditorValue(e.target.value)}
                  onPaste={activeTab === "html" ? handleHtmlPaste : undefined}
                  className="flex-1 resize-none bg-transparent font-mono text-sm leading-[1.625rem] p-2 focus:outline-none text-foreground"
                  spellCheck={false}
                  style={{ tabSize: 2 }}
                  data-testid={`editor-${activeTab}`}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 shrink-0">
            {editorCollapsed && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditorCollapsed(false)}
                data-testid="button-expand-editor"
                title="Mostrar editor"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </Button>
            )}
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Resultado</span>
            {autoRun && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                ao vivo
              </span>
            )}
          </div>
          <div className="flex-1 relative bg-neutral-50 dark:bg-neutral-900 min-h-0">
            <iframe
              ref={iframeRef}
              title="Resultado"
              sandbox="allow-scripts allow-modals allow-forms allow-popups"
              className="absolute inset-0 w-full h-full border-0"
              data-testid="preview-iframe"
            />
          </div>
        </div>
      </div>

      {/* Mobile: empilhado com toggle */}
      <div className="flex sm:hidden flex-col flex-1 overflow-hidden">
        {mobileView === "editor" && (
          <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b bg-muted/30 shrink-0">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as ActiveTab)}
              >
                <TabsList>
                  <TabsTrigger value="html" className="text-xs gap-1 px-3" data-testid="tab-html-mobile">
                    {getTabIcon("html")}
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="css" className="text-xs gap-1 px-3" data-testid="tab-css-mobile">
                    {getTabIcon("css")}
                    CSS
                  </TabsTrigger>
                  <TabsTrigger value="js" className="text-xs gap-1 px-3" data-testid="tab-js-mobile">
                    {getTabIcon("js")}
                    JS
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex-1 relative overflow-hidden">
              <textarea
                value={currentValue}
                onChange={(e) => setEditorValue(e.target.value)}
                onPaste={activeTab === "html" ? handleHtmlPaste : undefined}
                className="absolute inset-0 w-full h-full resize-none bg-transparent font-mono text-sm leading-relaxed p-3 focus:outline-none text-foreground"
                spellCheck={false}
                style={{ tabSize: 2 }}
                data-testid={`editor-mobile-${activeTab}`}
              />
            </div>
          </div>
        )}

        {mobileView === "preview" && (
          <div className="flex flex-col flex-1 relative">
            <div className="flex-1 relative bg-white dark:bg-neutral-900 min-h-0">
              <iframe
                ref={mobileIframeRef}
                title="Resultado"
                sandbox="allow-scripts allow-modals allow-forms allow-popups"
                className="absolute inset-0 w-full h-full border-0"
                data-testid="preview-iframe-mobile"
              />
            </div>
            <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
              <Button
                size="icon"
                variant="default"
                className="rounded-full shadow-lg opacity-80"
                onClick={handleFullScreen}
                data-testid="button-mobile-fullscreen"
              >
                <Maximize className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="default"
                className="rounded-full shadow-lg opacity-80"
                onClick={() => setMobileView("editor")}
                data-testid="button-mobile-back-editor"
              >
                <CodeXml className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
