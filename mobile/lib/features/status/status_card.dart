import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:shimmer/shimmer.dart';

enum ServiceState { loading, ok, degraded, error }

class _Look {
  const _Look(this.label, this.color, this.background);
  final String label;
  final Color color;
  final Color background;
}

const _looks = {
  ServiceState.ok: _Look('Operational', Color(0xFF059669), Color(0xFFECFDF5)),
  ServiceState.degraded: _Look('Degraded', Color(0xFFD97706), Color(0xFFFFFBEB)),
  ServiceState.error: _Look('Unreachable', Color(0xFFDC2626), Color(0xFFFEF2F2)),
  ServiceState.loading: _Look('Checking…', Color(0xFF78716C), Color(0xFFF5F5F4)),
};

class StatusCard extends StatelessWidget {
  const StatusCard({
    super.key,
    required this.title,
    required this.icon,
    required this.state,
    required this.rows,
    this.note,
    this.index = 0,
  });

  final String title;
  final IconData icon;
  final ServiceState state;
  final List<MapEntry<String, String>> rows;
  final String? note;
  final int index;

  @override
  Widget build(BuildContext context) {
    final look = _looks[state]!;
    final theme = Theme.of(context);

    return Semantics(
      container: true,
      label: '$title status: ${look.label}',
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE7E5E4)),
          boxShadow: const [
            BoxShadow(color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, 4)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: brandOrange),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                _Badge(look: look, pulse: state != ServiceState.loading),
              ],
            ),
            const SizedBox(height: 16),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: state == ServiceState.loading
                  ? const _Skeleton(key: ValueKey('skeleton'))
                  : Column(
                      key: const ValueKey('rows'),
                      children: [
                        for (final r in rows)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(r.key, style: const TextStyle(color: Color(0xFF78716C))),
                                const SizedBox(width: 16),
                                Flexible(
                                  child: Text(
                                    r.value,
                                    textAlign: TextAlign.right,
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (note != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              note!,
                              style: const TextStyle(color: Color(0xFF78716C), fontSize: 14),
                            ),
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    )
        .animate(delay: (150 * index).ms)
        .fadeIn(duration: 500.ms)
        .slideY(begin: 0.15, end: 0, duration: 500.ms, curve: Curves.easeOut);
  }
}

const Color brandOrange = Color(0xFFEA580C);

class _Badge extends StatelessWidget {
  const _Badge({required this.look, required this.pulse});
  final _Look look;
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: look.background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Dot(color: look.color, pulse: pulse),
          const SizedBox(width: 6),
          Text(
            look.label,
            style: TextStyle(color: look.color, fontWeight: FontWeight.w600, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color, required this.pulse});
  final Color color;
  final bool pulse;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 14,
      height: 14,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none, // let the pulse ring grow past the 14px box
        children: [
          if (pulse)
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.5),
                shape: BoxShape.circle,
              ),
            )
                .animate(onPlay: (c) => c.repeat())
                .scale(
                  begin: const Offset(1, 1),
                  end: const Offset(2.2, 2.2),
                  duration: 1400.ms,
                  curve: Curves.easeOut,
                )
                .fadeOut(duration: 1400.ms),
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
        ],
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: const Color(0xFFF5F5F4),
      highlightColor: const Color(0xFFFFFFFF),
      child: Column(
        children: [
          for (var i = 0; i < 3; i++)
            Container(
              height: 18,
              margin: const EdgeInsets.symmetric(vertical: 5),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(6),
              ),
            ),
        ],
      ),
    );
  }
}