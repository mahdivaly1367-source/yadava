import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';

describe('Navanegar App Integration UI Smoke Test', () => {
  it('renders DashboardView and navigates cleanly across all 5 views with zero runtime errors', async () => {
    // Mock canvas 2d context for InstrumentBridgeCanvas inside JSDOM
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/پیشنهاد هوشمند جلسه بعدی/)).toBeInTheDocument();
    });

    // 1. DashboardView
    expect(screen.getByText(/برنامه تمرین روزانه ۱۵ دقیقه‌ای تطبیقی/)).toBeInTheDocument();

    // 2. PracticeStudioView
    fireEvent.click(screen.getAllByText('کارگاه تمرین')[0]);
    expect(screen.getByText(/عقربه سنت زنده/)).toBeInTheDocument();
    expect(screen.getByText(/خط حامل ایرانی/)).toBeInTheDocument();

    // 3. RadifExplorerView
    fireEvent.click(screen.getAllByText('مرورگر ردیف')[0]);
    expect(screen.getByText(/مرورگر جامع ردیف موسیقی اصیل ایرانی/)).toBeInTheDocument();
    expect(screen.getByText(/نمایش ۱۷۳ گوشه در ۱۲ نظام/)).toBeInTheDocument();

    // 4. ModulationMapView
    fireEvent.click(screen.getAllByText('نقشه مدولاسیون')[0]);
    expect(screen.getByText(/نقشه تعاملی مدولاسیون و مرکب‌خوانی ردیف/)).toBeInTheDocument();

    // 5. CommunityView
    fireEvent.click(screen.getAllByText('انجمن زنده')[0]);
    expect(screen.getByText(/انجمن موسیقی‌دانان و اتاق‌های تمرین زنده/)).toBeInTheDocument();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
