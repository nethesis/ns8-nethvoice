"""Private metadata/transcript queries, authenticated independently of call control."""

import hmac
import os
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

ID = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")


def create_monitoring_router(runtime):
    async def auth(request: Request):
        token=os.getenv("API_TOKEN","")
        supplied=request.headers.get("authorization","")
        if not token or not hmac.compare_digest(supplied,"Bearer "+token):
            raise HTTPException(401,"unauthorized")

    router=APIRouter(prefix="/api/agent/v1/monitoring",dependencies=[Depends(auth)])

    async def read(op,*args,**kwargs):
        try: return await runtime.monitoring.read(op,*args,**kwargs)
        except ValueError: raise HTTPException(400,"invalid_query") from None
        except Exception: raise HTTPException(503,"monitoring_unavailable") from None

    async def run(run_id):
        if not ID.fullmatch(run_id): raise HTTPException(400,"invalid_run_id")
        value=await read("run",run_id)
        if value is None: raise HTTPException(404,"run_not_found")
        # Ownership is live runtime state; durable 'active' records can be stale.
        if value["status"]=="active" and value["session_id"] not in runtime.calls:
            value["status"]="unknown";value["complete"]=False
        return value

    @router.get("/overview")
    async def overview(hours: int=Query(24,ge=1,le=24*365)):
        since=time.time()-hours*3600
        try:
            history=await runtime.monitoring.read("overview",since,list(runtime.calls))
        except Exception:
            history={"since":since,"outcomes":[],"tool_errors":None,"history_complete":False,"recorders":[],"history_available":False}
        history.update({"health":runtime.monitoring.health(),"readiness":runtime.readiness(),
            "active_runs":[runtime.call_status(c.session_id) for c in runtime.calls.values()]})
        history["history_complete"]=history["history_complete"] and runtime.monitoring.health()["available"]
        return history

    @router.get("/health")
    async def health(): return runtime.monitoring.health()

    @router.get("/agents")
    async def agents():
        payload=runtime.store.snapshot
        if callable(payload): payload=payload()
        payload=payload or {};profiles=payload.get("profiles",{})
        bindings={b["id"]:b for b in payload.get("bindings",[])}
        return {"policy":runtime.monitoring.policy,"items":[{"agent_id":key,
            "provider":bindings.get(p.get("trunk_id"),{}).get("provider"),
            "configured":p.get("trunk_id") in bindings,"transcript_supported":bindings.get(p.get("trunk_id"),{}).get("provider")=="openai"}
            for key,p in profiles.items()]}

    @router.get("/runs")
    async def runs(limit:int=Query(50,ge=1,le=100),cursor:str|None=Query(None,max_length=512),
        agent:str|None=Query(None,pattern="^(internal|external)$"),provider:str|None=Query(None,pattern="^(openai|grok)$"),
        outcome:str|None=Query(None,pattern="^(active|completed|fallback|handed_off|unknown|interrupted|failed)$"),
        correlation:str|None=Query(None,max_length=128),after:float|None=Query(None,ge=0,le=1e12),
        before:float|None=Query(None,ge=0,le=1e12),tool_error:bool=False):
        result=await read("list_runs",limit=limit,cursor=cursor,agent=agent,provider=provider,outcome=outcome,
            correlation=correlation,after=after,before=before,tool_error=tool_error,active_sessions=list(runtime.calls))
        for value in result["items"]:
            if value["status"]=="active" and value["session_id"] not in runtime.calls:
                value["status"]="unknown";value["complete"]=False
        return result

    @router.get("/runs/{run_id}")
    async def detail(run_id:str): return await run(run_id)

    @router.get("/runs/{run_id}/events")
    async def events(run_id:str,limit:int=Query(50,ge=1,le=100),cursor:str|None=Query(None,max_length=512)):
        await run(run_id)
        return await read("events",run_id,limit,cursor)

    @router.get("/runs/{run_id}/transcript")
    async def transcript(run_id:str,response:Response):
        await run(run_id);response.headers["Cache-Control"]="no-store"
        try: return await runtime.monitoring.conversation(run_id)
        except Exception: raise HTTPException(503,"transcript_unavailable") from None

    @router.delete("/runs/{run_id}/transcript")
    async def delete(run_id:str,request:Request,response:Response):
        await run(run_id)
        actor=request.headers.get("x-monitoring-actor","")
        if not re.fullmatch(r"[A-Za-z0-9_.@-]{1,128}",actor): raise HTTPException(400,"invalid_actor")
        try: deleted=await runtime.monitoring.delete_text(run_id,actor)
        except Exception: raise HTTPException(503,"transcript_unavailable") from None
        if not deleted: raise HTTPException(404,"run_not_found")
        for call in list(runtime.calls.values()):
            if call.run_id==run_id and call.profile.get("_capture_transcripts"):
                call.profile["_capture_transcripts"]=False
                if call.adapter and hasattr(call.adapter,"set_capture"):
                    runtime._spawn(runtime._stop_capture(call.adapter))
        response.headers["Cache-Control"]="no-store"
        return {"state":"deleted"}

    @router.post("/retention")
    async def retention():
        await read("purge")
        return {"status":"complete"}

    return router
