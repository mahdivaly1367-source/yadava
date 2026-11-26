import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';

describe('Navanegar App Integration UI Smoke Test', () => {
  it('renders DashboardView, all 5 lazy views, and all Phase 1–3 studio panels with zero runtime errors', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
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

    // 1. DashboardView + Phase-1 & Phase-2 Panels (Paths & Classical Pieces)
    expect(screen.getByText(/برنامه تمرین روزانه ۱۵ دقیقه‌ای تطبیقی/)).toBeInTheDocument();
    expect(screen.getByText(/آکادمی اختصاصی تربیت گوش ربع‌پرده/)).toBeInTheDocument();
    expect(screen.getByText(/تقویم حرارتی تمرین/)).toBeInTheDocument();
    expect(screen.getByText(/چالش‌های هفتگی ردیف/)).toBeInTheDocument();
    expect(screen.getByText(/مسیرهای یادگیری ساختارمند ۳۰ روزه/)).toBeInTheDocument();
    expect(screen.getByText(/تصنیف‌خانه، پیش‌درآمد، چهارمضراب و رنگ/)).toBeInTheDocument();

    // Open lazy Audio Glossary Modal & close it
    fireEvent.click(screen.getByText(/فرهنگ صوتی/));
    expect(await screen.findByText(/فرهنگ صوتی تعاملی اصطلاحات ردیف/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('بستن فرهنگ صوتی'));

    // Open lazy Teacher Assignment Modal & close it
    fireEvent.click(screen.getByText(/کلاس استاد \/ تکلیف/));
    expect(await screen.findByText(/حالت کلاس استاد و تکلیف هفتگی/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('بستن'));

    // Open lazy Export, Share Card & Offline JSON Backup Modal & close it
    fireEvent.click(screen.getByText(/کارت پیشرفت و خروجی/));
    expect(await screen.findByText(/خروجی استاندارد استودیویی و اشتراک‌گذاری/)).toBeInTheDocument();
    expect(screen.getByText(/پشتیبان‌گیری و بازیابی کامل آفلاین/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('بستن'));

    // 2. Lazy PracticeStudioView + 7 Instruments + Ornaments + Music Stand + All Phase 1–3 Labs
    fireEvent.click(screen.getAllByText('کارگاه تمرین')[0]);
    expect(await screen.findByText(/عقربه سنت زنده/)).toBeInTheDocument();
    expect(screen.getByText(/خط حامل ایرانی/)).toBeInTheDocument();
    expect(screen.getByText(/منحنی زنده زیر و بمی/)).toBeInTheDocument();
    expect(screen.getByText(/زینت زنده/)).toBeInTheDocument();
    expect(screen.getByText('کمانچه')).toBeInTheDocument();
    expect(screen.getByText('عود (بربت)')).toBeInTheDocument();
    expect(screen.getByText('تنبور')).toBeInTheDocument();

    // Tar/Setar Fingering Guide strip visible on default bridge tab
    expect(screen.getByText(/راهنمای پیشنهادی انگشت‌گذاری و انتخاب سیم/)).toBeInTheDocument();

    // Open & close Landscape Music-Stand Mode (Wake Lock)
    fireEvent.click(screen.getByText('پایه نت'));
    expect(await screen.findByText(/حالت پایه نت —/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('بستن'));

    // Phase-3 Studio Labs: Call & Response, Prosody Avaz, Blind Ear-Tuning
    fireEvent.click(screen.getByText('سؤال و جواب (بداهه)'));
    expect(await screen.findByText(/تمرین «سؤال و جواب» و بداهه‌نوازی هدایت‌شده/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('آواز و تقطیع عروضی'));
    expect(await screen.findByText(/تلفیق شعر و نت با تقطیع عروضی/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('کوک با گوش'));
    expect(await screen.findByText(/آزمایشگاه «کوک کردن با گوش»/)).toBeInTheDocument();

    // Phase-1 & Phase-2 Studio Tabs
    fireEvent.click(screen.getByText('واخوان (Drone)'));
    expect(await screen.findByText(/واخوان \/ پِدال هوشمند دستگاه/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('آهسته‌ساز و نت‌نگار'));
    expect(await screen.findByText(/آهسته‌ساز و نت‌نگار خودکار فایل صوتی استاد/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('کوک و ربع‌پرده'));
    expect(await screen.findByText(/ویرایشگر کوک و ربع‌پرده‌های اختصاصی/)).toBeInTheDocument();

    // 3. Lazy RadifExplorerView
    fireEvent.click(screen.getAllByText('مرورگر ردیف')[0]);
    expect(await screen.findByText(/مرورگر جامع ردیف موسیقی اصیل ایرانی/)).toBeInTheDocument();
    expect(screen.getByText(/نمایش ۱۷۳ گوشه در ۱۲ نظام/)).toBeInTheDocument();

    // 4. Lazy ModulationMapView
    fireEvent.click(screen.getAllByText('نقشه مدولاسیون')[0]);
    expect(await screen.findByText(/نقشه تعاملی مدولاسیون و مرکب‌خوانی ردیف/)).toBeInTheDocument();

    // 5. Lazy CommunityView
    fireEvent.click(screen.getAllByText('انجمن زنده')[0]);
    expect((await screen.findAllByText(/انجمن|ضبط/)).length).toBeGreaterThan(0);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  }, 20000);
});
