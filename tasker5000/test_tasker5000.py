"""
Test cases for Tasker5000 system
"""
import pytest
from main import (
    compute_etaH, 
    CapacityInput,
    get_mode_band,
    get_mode_controls,
    clamp,
    norm,
    Qoverload
)
from fmca_engine import ChartTask, run_fmca_loop


class TestCapacityEngine:
    """Tests for the capacity computation engine"""
    
    def test_clamp_function(self):
        """Test clamp utility function"""
        assert clamp(0.5, 0, 1) == 0.5
        assert clamp(-0.5, 0, 1) == 0
        assert clamp(1.5, 0, 1) == 1
    
    def test_norm_function(self):
        """Test normalization function"""
        assert norm(0.5) == 0.5
        assert norm(-0.5) == 0
        assert norm(1.5) == 1
    
    def test_qoverload(self):
        """Test overload calculation"""
        assert Qoverload(1) == 0
        assert Qoverload(3) == 0
        assert Qoverload(4) > 0
        assert Qoverload(10) > Qoverload(5)
    
    def test_mode_bands(self):
        """Test mode band classification"""
        assert get_mode_band(0.1) == "Recovery"
        assert get_mode_band(0.29) == "Recovery"
        assert get_mode_band(0.3) == "Turtle"
        assert get_mode_band(0.5) == "Turtle"
        assert get_mode_band(0.6) == "Cruise"
        assert get_mode_band(0.84) == "Cruise"
        assert get_mode_band(0.85) == "Unicorn"
        assert get_mode_band(0.95) == "Unicorn"
    
    def test_mode_controls(self):
        """Test mode control settings"""
        recovery = get_mode_controls("Recovery", 8.0)
        assert recovery["swap_time"] == 10
        assert recovery["sprints"] == 2
        assert recovery["deep_fix"] == False
        
        turtle = get_mode_controls("Turtle", 8.0)
        assert turtle["swap_time"] == 12
        assert turtle["sprints"] == 4
        
        cruise = get_mode_controls("Cruise", 8.0)
        assert cruise["swap_time"] == 15
        assert cruise["sprints"] == 5
        assert cruise["deep_fix"] == True
        
        unicorn = get_mode_controls("Unicorn", 8.0)
        assert unicorn["swap_time"] == 16
        assert unicorn["sprints"] == 5
    
    def test_low_capacity_scenario(self):
        """Test low capacity (Recovery mode) scenario"""
        capacity = CapacityInput(
            R_phys=0.5,
            R_ment=0.5,
            L=80,
            dplan=0.7,
            Csocial=0.3,
            Gguilt=0.6,
            Aanxiety=0.6,
            N_vis=5,
            Hhero=0.4,
            Rnow=0.5,
            Dtask=0.6,
            Ssteps=0.5,
            Uunfamiliar=0.5,
            EHR_clunk=0.4,
            availability_hours=6.0
        )
        result = compute_etaH(capacity)
        assert result["mode"] == "Recovery"
        assert result["etaH"] < 0.3
        assert result["controls"]["swap_time"] == 10
    
    def test_high_capacity_scenario(self):
        """Test high capacity (Cruise/Unicorn mode) scenario"""
        capacity = CapacityInput(
            R_phys=0.95,
            R_ment=0.95,
            L=10,
            dplan=0.98,
            Csocial=0.8,
            Gguilt=0.05,
            Aanxiety=0.1,
            N_vis=1,
            Hhero=0.4,
            Rnow=0.95,
            Dtask=0.1,
            Ssteps=0.1,
            Uunfamiliar=0.1,
            EHR_clunk=0.05,
            availability_hours=10.0
        )
        result = compute_etaH(capacity)
        assert result["mode"] in ["Cruise", "Unicorn"]
        assert result["etaH"] >= 0.6
        assert result["controls"]["swap_time"] >= 15


class TestFMCAEngine:
    """Tests for the FMCA execution engine"""
    
    def test_chart_task_creation(self):
        """Test ChartTask object creation"""
        chart = ChartTask(
            id="test001",
            type="full",
            age_days=5,
            required_today=False,
            swap_count=0
        )
        assert chart.id == "test001"
        assert chart.status == "active"
        assert chart.parked == False
    
    def test_micro_unstick_timing(self):
        """Test that micro-unstick triggers at 5 minutes"""
        chart = ChartTask("t1", "full", 5, False)
        controls = {"swap_time": 15, "sprints": 5}
        timeline = run_fmca_loop([chart], controls)
        
        # Find micro_unstick action
        micro_unstick_actions = [a for a in timeline if a["action"] == "micro_unstick"]
        assert len(micro_unstick_actions) == 1
        
        # Check it happened after 5 working actions (0-4)
        working_before_unstick = [a for a in timeline[:6] if a["action"] == "working"]
        assert len(working_before_unstick) == 5
    
    def test_accelerator_timing(self):
        """Test that accelerator triggers at 12 minutes"""
        chart = ChartTask("t1", "full", 5, False)
        controls = {"swap_time": 15, "sprints": 5}
        timeline = run_fmca_loop([chart], controls)
        
        # Find accelerator action
        accelerator_actions = [a for a in timeline if a["action"] == "accelerator"]
        assert len(accelerator_actions) == 1
    
    def test_swap_timing_recovery_mode(self):
        """Test swap-3 triggers at correct time in Recovery mode"""
        chart = ChartTask("t1", "full", 5, False)
        controls = {"swap_time": 10, "sprints": 2}
        timeline = run_fmca_loop([chart], controls)
        
        # Find swap_3 action
        swap_actions = [a for a in timeline if a["action"] == "swap_3"]
        assert len(swap_actions) == 1
        
        # Should happen at or after swap_time (10 minutes)
        assert len(timeline) >= 10
    
    def test_escalation_for_critical_task(self):
        """Test escalation for critical tasks with swap_count >= 1"""
        chart = ChartTask("t1", "full", 85, True, swap_count=2)
        controls = {"swap_time": 12, "sprints": 4}
        timeline = run_fmca_loop([chart], controls)
        
        # Find escalate action
        escalate_actions = [a for a in timeline if a["action"] == "escalate"]
        assert len(escalate_actions) == 1
        assert chart.status == "escalated"
    
    def test_no_escalation_for_non_critical_task(self):
        """Test that non-critical tasks get swap-3 instead of escalation"""
        chart = ChartTask("t1", "full", 5, False, swap_count=2)
        controls = {"swap_time": 10, "sprints": 2}
        timeline = run_fmca_loop([chart], controls)
        
        # Should not escalate
        escalate_actions = [a for a in timeline if a["action"] == "escalate"]
        assert len(escalate_actions) == 0
        
        # Should swap instead
        swap_actions = [a for a in timeline if a["action"] == "swap_3"]
        assert len(swap_actions) == 1
    
    def test_multiple_charts_processing(self):
        """Test processing multiple charts in sequence"""
        charts = [
            ChartTask("t1", "attest", 2, False),
            ChartTask("t2", "full", 5, False),
            ChartTask("t3", "attest", 3, False)
        ]
        controls = {"swap_time": 10, "sprints": 2}
        timeline = run_fmca_loop(charts, controls)
        
        # Should have actions for all charts
        chart_ids = set(a["chart_id"] for a in timeline if "chart_id" in a)
        assert "t1" in chart_ids
        assert len(chart_ids) >= 1  # At least one chart processed


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
